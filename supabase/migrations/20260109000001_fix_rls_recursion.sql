-- Fix RLS infinite recursion on user_profiles
-- The admin check was querying user_profiles from within user_profiles policy

-- Create a security definer function to check admin status
-- This bypasses RLS to prevent recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read waitlist" ON waitlist;
DROP POLICY IF EXISTS "Admins can update waitlist" ON waitlist;
DROP POLICY IF EXISTS "Admins can read credit_transactions" ON credit_transactions;

-- Recreate policies using the security definer function

-- User profiles: Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON user_profiles
    FOR SELECT USING (is_admin());

-- Waitlist: Admins can SELECT all
CREATE POLICY "Admins can read waitlist" ON waitlist
    FOR SELECT USING (is_admin());

-- Waitlist: Admins can UPDATE
CREATE POLICY "Admins can update waitlist" ON waitlist
    FOR UPDATE USING (is_admin());

-- Credit transactions: Admins can read all
CREATE POLICY "Admins can read credit_transactions" ON credit_transactions
    FOR SELECT USING (is_admin());
