-- Keep gatekeeper_drafts after ledger submit so completed journals remain in the journal list.
ALTER TABLE public.gatekeeper_drafts
  ADD COLUMN IF NOT EXISTS trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS gatekeeper_drafts_trade_id_idx
  ON public.gatekeeper_drafts (trade_id)
  WHERE trade_id IS NOT NULL;

COMMENT ON COLUMN public.gatekeeper_drafts.trade_id IS
  'Ledger trade id (same uuid as draft id when promoted). Draft row is retained for journal history.';
COMMENT ON COLUMN public.gatekeeper_drafts.submitted_at IS
  'Set when execution is saved to the trades ledger.';
COMMENT ON COLUMN public.gatekeeper_drafts.completed_at IS
  'Set when the Outcome step is finished.';
