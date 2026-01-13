-- Backfill existing user data that was missed due to broken trigger
-- This is a one-time fix for users created before the trigger was fixed

-- 1. Backfill full_name and organization from waitlist
UPDATE user_profiles up
SET
    full_name = w.full_name,
    organization = w.organization,
    updated_at = NOW()
FROM waitlist w
WHERE up.email = w.email
  AND w.status = 'approved'
  AND (up.full_name IS NULL OR up.full_name = '');

-- 2. Create missing credit transactions for existing signup bonuses
INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, description)
SELECT
    up.id,
    1000,
    1000,
    'signup_bonus',
    'Welcome bonus credits (backfilled)'
FROM user_profiles up
WHERE NOT EXISTS (
    SELECT 1 FROM credit_transactions ct
    WHERE ct.user_id = up.id AND ct.transaction_type = 'signup_bonus'
);

-- 3. Create missing rate_limit_state entries
INSERT INTO rate_limit_state (user_id)
SELECT id FROM user_profiles
ON CONFLICT DO NOTHING;
