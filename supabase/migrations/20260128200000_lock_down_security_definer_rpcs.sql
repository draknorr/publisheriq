-- Migration: Lock down SECURITY DEFINER RPC functions
--
-- SECURITY FIX: These functions run with elevated privileges (SECURITY DEFINER)
-- but were previously callable by PUBLIC and anon roles. This could allow
-- unauthenticated users to:
--   - execute_readonly_query: Run arbitrary SELECT queries against the database
--   - reserve_credits: Reserve credits from any user's account
--   - finalize_credits: Finalize credit transactions
--   - refund_reservation: Refund credit reservations
--   - check_and_increment_rate_limit: Manipulate rate limiting
--
-- This migration revokes access from PUBLIC and anon, keeping only:
--   - authenticated: Normal authenticated users (required for chat functionality)
--   - service_role: Backend services
--   - postgres: Database admin

-- Revoke from PUBLIC (includes all roles by default)
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_credits(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_credits(uuid, integer, text, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_reservation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid) FROM PUBLIC;

-- Explicitly revoke from anon role (Supabase's unauthenticated role)
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_credits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_credits(uuid, integer, text, integer, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_reservation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid) FROM anon;

-- Ensure authenticated users can still use the functions (chat requires these)
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_credits(uuid, integer, text, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid) TO authenticated;

-- Ensure service_role retains access (backend services)
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_credits(uuid, integer, text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_reservation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid) TO service_role;
