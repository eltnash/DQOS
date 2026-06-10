-- Named Gatekeeper journals (unique per user) for resume-from-Journal-tab workflow
ALTER TABLE public.gatekeeper_drafts
  ADD COLUMN IF NOT EXISTS journal_name TEXT;

UPDATE public.gatekeeper_drafts
SET journal_name = 'Session ' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
WHERE journal_name IS NULL OR btrim(journal_name) = '';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, journal_name
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.gatekeeper_drafts
)
UPDATE public.gatekeeper_drafts AS g
SET journal_name = g.journal_name || ' (' || substring(r.id::text, 1, 8) || ')'
FROM ranked r
WHERE g.id = r.id
  AND r.rn > 1;

ALTER TABLE public.gatekeeper_drafts
  ALTER COLUMN journal_name SET NOT NULL;

DROP INDEX IF EXISTS gatekeeper_drafts_session_unique;

CREATE UNIQUE INDEX IF NOT EXISTS gatekeeper_drafts_user_journal_name_unique
  ON public.gatekeeper_drafts (user_id, journal_name);

COMMENT ON COLUMN public.gatekeeper_drafts.journal_name IS
  'User-chosen unique label for this in-progress Gatekeeper journal; shown on Journal tab';
