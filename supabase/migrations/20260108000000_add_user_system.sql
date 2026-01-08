-- =============================================
-- User Authentication and Credits System
-- =============================================
-- This migration adds:
-- 1. User profiles extending Supabase auth.users
-- 2. Invite-only waitlist system
-- 3. Credit-based usage tracking with reservation pattern
-- 4. Rate limiting
-- =============================================

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE waitlist_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE credit_transaction_type AS ENUM (
    'signup_bonus',     -- Initial credits on account creation
    'admin_grant',      -- Admin manually adds credits
    'admin_deduct',     -- Admin manually removes credits
    'chat_usage',       -- Consumed by chat (finalized reservation)
    'refund'            -- Refund for failed operations
);
CREATE TYPE credit_reservation_status AS ENUM ('pending', 'finalized', 'refunded');

-- =============================================
-- USER PROFILES (extends Supabase auth.users)
-- =============================================

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    organization TEXT,
    role user_role NOT NULL DEFAULT 'user',
    credit_balance INTEGER NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
    total_credits_used INTEGER NOT NULL DEFAULT 0,
    total_messages_sent INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- =============================================
-- WAITLIST
-- =============================================

CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    organization TEXT,
    how_i_plan_to_use TEXT,
    status waitlist_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    invite_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_status ON waitlist(status);
CREATE INDEX idx_waitlist_created_at ON waitlist(created_at DESC);

-- =============================================
-- CREDIT TRANSACTIONS (Immutable Audit Log)
-- =============================================

CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,  -- Positive for grants, negative for usage
    balance_after INTEGER NOT NULL,
    transaction_type credit_transaction_type NOT NULL,
    description TEXT,
    -- Chat usage metadata (only for chat_usage type)
    input_tokens INTEGER,
    output_tokens INTEGER,
    tool_credits INTEGER,
    -- Admin action metadata
    admin_user_id UUID REFERENCES auth.users(id),
    -- Link to reservation if applicable
    reservation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user_date ON credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);

-- =============================================
-- CREDIT RESERVATIONS (for deduct-at-start pattern)
-- =============================================

CREATE TABLE credit_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    reserved_amount INTEGER NOT NULL,
    actual_amount INTEGER,  -- Filled in when finalized
    status credit_reservation_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_at TIMESTAMPTZ
);

CREATE INDEX idx_credit_reservations_user_pending ON credit_reservations(user_id)
    WHERE status = 'pending';
CREATE INDEX idx_credit_reservations_created ON credit_reservations(created_at DESC);

-- =============================================
-- RATE LIMITING
-- =============================================

CREATE TABLE rate_limit_state (
    user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    requests_this_minute INTEGER NOT NULL DEFAULT 0,
    requests_this_hour INTEGER NOT NULL DEFAULT 0,
    minute_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hour_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- MODIFY chat_query_logs TO INCLUDE USER/CREDIT INFO
-- =============================================

ALTER TABLE chat_query_logs
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id),
    ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
    ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
    ADD COLUMN IF NOT EXISTS tool_credits_used INTEGER,
    ADD COLUMN IF NOT EXISTS total_credits_charged INTEGER,
    ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES credit_reservations(id);

CREATE INDEX IF NOT EXISTS idx_chat_query_logs_user_id ON chat_query_logs(user_id, created_at DESC);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Trigger: Auto-create user profile when auth.users is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_initial_credits INTEGER := 1000;  -- Default signup bonus ($10)
    v_waitlist_entry RECORD;
BEGIN
    -- Look up waitlist entry for additional info
    SELECT full_name, organization INTO v_waitlist_entry
    FROM waitlist
    WHERE email = NEW.email AND status = 'approved'
    LIMIT 1;

    -- Create user profile
    INSERT INTO user_profiles (id, email, full_name, organization, credit_balance)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(v_waitlist_entry.full_name, ''),
        v_waitlist_entry.organization,
        v_initial_credits
    );

    -- Create initial credit transaction for signup bonus
    INSERT INTO credit_transactions (
        user_id,
        amount,
        balance_after,
        transaction_type,
        description
    )
    VALUES (
        NEW.id,
        v_initial_credits,
        v_initial_credits,
        'signup_bonus',
        'Welcome bonus credits'
    );

    -- Initialize rate limit state
    INSERT INTO rate_limit_state (user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function: Reserve credits upfront (returns reservation_id or NULL if insufficient)
CREATE OR REPLACE FUNCTION reserve_credits(
    p_user_id UUID,
    p_amount INTEGER
)
RETURNS UUID AS $$
DECLARE
    v_current_balance INTEGER;
    v_reservation_id UUID;
BEGIN
    -- Lock the user row and get current balance
    SELECT credit_balance INTO v_current_balance
    FROM user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RETURN NULL;  -- User not found
    END IF;

    IF v_current_balance < p_amount THEN
        RETURN NULL;  -- Insufficient credits
    END IF;

    -- Deduct from balance
    UPDATE user_profiles
    SET credit_balance = credit_balance - p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Create reservation record
    INSERT INTO credit_reservations (user_id, reserved_amount, status)
    VALUES (p_user_id, p_amount, 'pending')
    RETURNING id INTO v_reservation_id;

    RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Finalize reservation (charge actual, refund excess)
CREATE OR REPLACE FUNCTION finalize_credits(
    p_reservation_id UUID,
    p_actual_amount INTEGER,
    p_description TEXT DEFAULT NULL,
    p_input_tokens INTEGER DEFAULT NULL,
    p_output_tokens INTEGER DEFAULT NULL,
    p_tool_credits INTEGER DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, refunded INTEGER, new_balance INTEGER) AS $$
DECLARE
    v_reservation RECORD;
    v_refund_amount INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Get and lock the reservation
    SELECT r.*, u.credit_balance
    INTO v_reservation
    FROM credit_reservations r
    JOIN user_profiles u ON u.id = r.user_id
    WHERE r.id = p_reservation_id AND r.status = 'pending'
    FOR UPDATE OF r, u;

    IF v_reservation IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 0::INTEGER;
        RETURN;
    END IF;

    -- Calculate refund (if actual < reserved)
    v_refund_amount := GREATEST(0, v_reservation.reserved_amount - p_actual_amount);

    -- Refund excess to balance
    UPDATE user_profiles
    SET credit_balance = credit_balance + v_refund_amount,
        total_credits_used = total_credits_used + p_actual_amount,
        total_messages_sent = total_messages_sent + 1,
        updated_at = NOW()
    WHERE id = v_reservation.user_id
    RETURNING credit_balance INTO v_new_balance;

    -- Mark reservation as finalized
    UPDATE credit_reservations
    SET status = 'finalized',
        actual_amount = p_actual_amount,
        finalized_at = NOW()
    WHERE id = p_reservation_id;

    -- Create transaction record
    INSERT INTO credit_transactions (
        user_id, amount, balance_after, transaction_type, description,
        input_tokens, output_tokens, tool_credits, reservation_id
    )
    VALUES (
        v_reservation.user_id,
        -p_actual_amount,
        v_new_balance,
        'chat_usage',
        COALESCE(p_description, 'Chat usage'),
        p_input_tokens,
        p_output_tokens,
        p_tool_credits,
        p_reservation_id
    );

    RETURN QUERY SELECT TRUE, v_refund_amount, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Refund reservation (full refund on server error)
CREATE OR REPLACE FUNCTION refund_reservation(p_reservation_id UUID)
RETURNS TABLE (success BOOLEAN, refunded INTEGER, new_balance INTEGER) AS $$
DECLARE
    v_reservation RECORD;
    v_new_balance INTEGER;
BEGIN
    -- Get and lock the reservation
    SELECT r.*, u.credit_balance
    INTO v_reservation
    FROM credit_reservations r
    JOIN user_profiles u ON u.id = r.user_id
    WHERE r.id = p_reservation_id AND r.status = 'pending'
    FOR UPDATE OF r, u;

    IF v_reservation IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 0::INTEGER;
        RETURN;
    END IF;

    -- Refund full amount
    UPDATE user_profiles
    SET credit_balance = credit_balance + v_reservation.reserved_amount,
        updated_at = NOW()
    WHERE id = v_reservation.user_id
    RETURNING credit_balance INTO v_new_balance;

    -- Mark reservation as refunded
    UPDATE credit_reservations
    SET status = 'refunded',
        actual_amount = 0,
        finalized_at = NOW()
    WHERE id = p_reservation_id;

    -- Create refund transaction record
    INSERT INTO credit_transactions (
        user_id, amount, balance_after, transaction_type, description, reservation_id
    )
    VALUES (
        v_reservation.user_id,
        v_reservation.reserved_amount,
        v_new_balance,
        'refund',
        'Server error refund',
        p_reservation_id
    );

    RETURN QUERY SELECT TRUE, v_reservation.reserved_amount, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Admin credit adjustment
CREATE OR REPLACE FUNCTION admin_adjust_credits(
    p_admin_id UUID,
    p_user_id UUID,
    p_amount INTEGER,  -- Positive to grant, negative to deduct
    p_description TEXT
)
RETURNS TABLE (success BOOLEAN, new_balance INTEGER) AS $$
DECLARE
    v_admin_role user_role;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_type credit_transaction_type;
BEGIN
    -- Verify admin role
    SELECT role INTO v_admin_role
    FROM user_profiles
    WHERE id = p_admin_id;

    IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER;
        RETURN;
    END IF;

    -- Get current balance with lock
    SELECT credit_balance INTO v_current_balance
    FROM user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER;
        RETURN;
    END IF;

    -- Calculate new balance (prevent going below 0)
    v_new_balance := GREATEST(0, v_current_balance + p_amount);

    -- Determine transaction type
    v_type := CASE WHEN p_amount >= 0 THEN 'admin_grant' ELSE 'admin_deduct' END;

    -- Update balance
    UPDATE user_profiles
    SET credit_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Record transaction
    INSERT INTO credit_transactions (
        user_id, amount, balance_after, transaction_type, description, admin_user_id
    )
    VALUES (
        p_user_id,
        p_amount,
        v_new_balance,
        v_type,
        p_description,
        p_admin_id
    );

    RETURN QUERY SELECT TRUE, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Atomic rate limit check and increment
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(p_user_id UUID)
RETURNS TABLE (allowed BOOLEAN, retry_after_seconds INTEGER) AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_minute_limit INTEGER := 20;   -- 20 requests per minute
    v_hour_limit INTEGER := 200;    -- 200 requests per hour
    v_state rate_limit_state%ROWTYPE;
    v_requests_minute INTEGER;
    v_requests_hour INTEGER;
    v_minute_start TIMESTAMPTZ;
    v_hour_start TIMESTAMPTZ;
BEGIN
    -- Get current state with lock (or create if missing)
    SELECT * INTO v_state
    FROM rate_limit_state
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Create state if missing
        INSERT INTO rate_limit_state (user_id)
        VALUES (p_user_id)
        RETURNING * INTO v_state;
    END IF;

    -- Calculate window resets
    v_minute_start := v_state.minute_window_start;
    v_hour_start := v_state.hour_window_start;
    v_requests_minute := v_state.requests_this_minute;
    v_requests_hour := v_state.requests_this_hour;

    -- Reset minute window if expired
    IF v_minute_start < v_now - INTERVAL '1 minute' THEN
        v_requests_minute := 0;
        v_minute_start := v_now;
    END IF;

    -- Reset hour window if expired
    IF v_hour_start < v_now - INTERVAL '1 hour' THEN
        v_requests_hour := 0;
        v_hour_start := v_now;
    END IF;

    -- Check minute limit
    IF v_requests_minute >= v_minute_limit THEN
        RETURN QUERY SELECT FALSE,
            EXTRACT(EPOCH FROM (v_minute_start + INTERVAL '1 minute' - v_now))::INTEGER;
        RETURN;
    END IF;

    -- Check hour limit
    IF v_requests_hour >= v_hour_limit THEN
        RETURN QUERY SELECT FALSE,
            EXTRACT(EPOCH FROM (v_hour_start + INTERVAL '1 hour' - v_now))::INTEGER;
        RETURN;
    END IF;

    -- Increment counters atomically
    UPDATE rate_limit_state
    SET requests_this_minute = v_requests_minute + 1,
        requests_this_hour = v_requests_hour + 1,
        minute_window_start = v_minute_start,
        hour_window_start = v_hour_start,
        updated_at = v_now
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT TRUE, 0::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user credit balance (simple helper)
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
    SELECT credit_balance FROM user_profiles WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_state ENABLE ROW LEVEL SECURITY;

-- User profiles: Users can read own profile
CREATE POLICY "Users can read own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- User profiles: Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- User profiles: Users can update own profile (limited fields via app logic)
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Waitlist: Public can INSERT (join waitlist)
CREATE POLICY "Public can submit to waitlist" ON waitlist
    FOR INSERT WITH CHECK (true);

-- Waitlist: Admins can SELECT all
CREATE POLICY "Admins can read waitlist" ON waitlist
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Waitlist: Admins can UPDATE
CREATE POLICY "Admins can update waitlist" ON waitlist
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Credit transactions: Users can read own transactions
CREATE POLICY "Users can read own transactions" ON credit_transactions
    FOR SELECT USING (user_id = auth.uid());

-- Credit transactions: Admins can read all
CREATE POLICY "Admins can read all transactions" ON credit_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Credit reservations: Users can read own
CREATE POLICY "Users can read own reservations" ON credit_reservations
    FOR SELECT USING (user_id = auth.uid());

-- Credit reservations: Admins can read all
CREATE POLICY "Admins can read all reservations" ON credit_reservations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Rate limit state: No direct user access (function-only via SECURITY DEFINER)
-- Service role can access for monitoring

-- =============================================
-- GRANTS
-- =============================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION reserve_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_credits(UUID, INTEGER, TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_reservation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_adjust_credits(UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_rate_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_credit_balance(UUID) TO authenticated;

-- Allow anon to insert into waitlist (for public signup)
GRANT INSERT ON waitlist TO anon;

-- =============================================
-- CLEANUP FUNCTION FOR STALE RESERVATIONS
-- =============================================

-- Function to clean up stale pending reservations (older than 1 hour)
-- This should be called periodically via cron
CREATE OR REPLACE FUNCTION cleanup_stale_reservations()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_reservation RECORD;
BEGIN
    -- Find and refund stale reservations
    FOR v_reservation IN
        SELECT id FROM credit_reservations
        WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '1 hour'
        FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM refund_reservation(v_reservation.id);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- UPDATE updated_at TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_profile_updated_at();
