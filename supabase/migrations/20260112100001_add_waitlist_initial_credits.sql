-- Add initial_credits column to waitlist table
-- This allows admins to set custom credit amounts during approval
ALTER TABLE waitlist
ADD COLUMN initial_credits INTEGER NOT NULL DEFAULT 1000;

COMMENT ON COLUMN waitlist.initial_credits IS 'Credits to grant on signup, set by admin during approval';
