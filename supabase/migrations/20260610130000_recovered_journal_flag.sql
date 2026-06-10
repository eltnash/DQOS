ALTER TABLE public.gatekeeper_drafts
  ADD COLUMN IF NOT EXISTS recovered_from_trade BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.gatekeeper_drafts.recovered_from_trade IS
  'True when this journal row was rebuilt from a trades ledger record after legacy draft deletion.';
