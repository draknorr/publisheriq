-- Additive phase-1 chat quality logging columns.
-- This migration is intentionally schema-only. Do not apply automatically.

ALTER TABLE public.chat_query_logs
  ADD COLUMN IF NOT EXISTS chat_family TEXT,
  ADD COLUMN IF NOT EXISTS quality_flags TEXT[],
  ADD COLUMN IF NOT EXISTS session_context_summary JSONB,
  ADD COLUMN IF NOT EXISTS guardrail_trace JSONB,
  ADD COLUMN IF NOT EXISTS answer_contract_summary JSONB;
