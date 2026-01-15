-- Fix: Remove policy that references auth.users which causes permission error for anon users
--
-- The "Users can select own waitlist entry" policy has a subquery that accesses auth.users.
-- When anon users submit to the waitlist via Supabase client's upsert(), PostgreSQL evaluates
-- this policy's subquery, which fails because anon cannot access auth.users.
--
-- This policy served no practical purpose anyway - authenticated users have already passed
-- the waitlist stage and don't need to see their waitlist entry.

DROP POLICY IF EXISTS "Users can select own waitlist entry" ON waitlist;
