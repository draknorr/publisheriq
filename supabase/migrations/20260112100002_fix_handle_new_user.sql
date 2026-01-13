-- Fix handle_new_user trigger to properly:
-- 1. Copy full_name and organization from waitlist
-- 2. Use admin-specified initial_credits (not hardcoded 1000)
-- 3. Create credit_transactions audit entry
-- 4. Initialize rate_limit_state

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_initial_credits INTEGER;
    v_waitlist_entry RECORD;
BEGIN
    -- Look up waitlist entry for user data and credits
    SELECT full_name, organization, initial_credits
    INTO v_waitlist_entry
    FROM waitlist
    WHERE email = NEW.email AND status = 'approved'
    LIMIT 1;

    -- Use waitlist credits or default to 1000
    v_initial_credits := COALESCE(v_waitlist_entry.initial_credits, 1000);

    -- Create user profile with waitlist data
    INSERT INTO user_profiles (id, email, full_name, organization, credit_balance)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(v_waitlist_entry.full_name, ''),
        v_waitlist_entry.organization,
        v_initial_credits
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        organization = EXCLUDED.organization,
        credit_balance = EXCLUDED.credit_balance;

    -- Create initial credit transaction for audit trail
    INSERT INTO credit_transactions (
        user_id, amount, balance_after, transaction_type, description
    )
    VALUES (
        NEW.id,
        v_initial_credits,
        v_initial_credits,
        'signup_bonus',
        'Welcome bonus credits'
    )
    ON CONFLICT DO NOTHING;

    -- Initialize rate limit state
    INSERT INTO rate_limit_state (user_id)
    VALUES (NEW.id)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
