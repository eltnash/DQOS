-- Soft-archive Gatekeeper journals (hide from default Journal list, restorable)
ALTER TABLE public.gatekeeper_drafts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS gatekeeper_drafts_user_list_idx
  ON public.gatekeeper_drafts (user_id, archived_at, updated_at DESC);

COMMENT ON COLUMN public.gatekeeper_drafts.archived_at IS
  'When set, journal is archived and hidden from the default Journal tab list';
