-- Persist in-progress execution fields (direction, entry, stop, size, target, notes) on named journals
ALTER TABLE public.gatekeeper_drafts
  ADD COLUMN IF NOT EXISTS execution_form JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.gatekeeper_drafts.execution_form IS
  'Draft execution block fields saved with the named Gatekeeper journal before Execute Trade';
