-- HTF context captured at Gatekeeper step 0 (Trading on the Edge / composite profile workflow)
ALTER TABLE public.execution_audits
  ADD COLUMN IF NOT EXISTS htf_context JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.execution_audits.htf_context IS
  'Higher timeframe auction context: analyzed TFs, composite VA position, structure bias, tools, narratives';
