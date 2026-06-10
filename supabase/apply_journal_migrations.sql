-- Journal + Gatekeeper cloud save (run once in Supabase SQL Editor)
-- Project: pgxxsivodspkycdvcpur

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Base table (older installs may already have this without journal_name / execution_form)
CREATE TABLE IF NOT EXISTS public.gatekeeper_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trading_date DATE NOT NULL,
  symbol TEXT NOT NULL,
  session_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  wizard_form JSONB NOT NULL DEFAULT '{}'::jsonb,
  media JSONB NOT NULL DEFAULT '{"htf":{},"pillars":{}}'::jsonb,
  ui_state JSONB NOT NULL DEFAULT '{"active_step":1,"active_timeframe_tab":"W"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.gatekeeper_drafts
  ADD COLUMN IF NOT EXISTS journal_name TEXT;

ALTER TABLE public.gatekeeper_drafts
  ADD COLUMN IF NOT EXISTS execution_form JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.gatekeeper_drafts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE public.gatekeeper_drafts
SET journal_name = 'Session ' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
WHERE journal_name IS NULL OR btrim(journal_name) = '';

-- Older backfills used minute precision and can collide; suffix duplicates before unique index
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

CREATE INDEX IF NOT EXISTS gatekeeper_drafts_user_list_idx
  ON public.gatekeeper_drafts (user_id, archived_at, updated_at DESC);

COMMENT ON TABLE public.gatekeeper_drafts IS
  'Named Gatekeeper journals — wizard, media, execution draft, resume from Journal tab';

DROP TRIGGER IF EXISTS gatekeeper_drafts_set_updated_at ON public.gatekeeper_drafts;
CREATE TRIGGER gatekeeper_drafts_set_updated_at
  BEFORE UPDATE ON public.gatekeeper_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.gatekeeper_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'gatekeeper_drafts' AND policyname = 'gatekeeper_drafts_self'
  ) THEN
    CREATE POLICY gatekeeper_drafts_self
    ON public.gatekeeper_drafts FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Screenshot storage bucket (if not already created)
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-screenshots', 'trade-screenshots', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trade_screenshots_self_read'
  ) THEN
    CREATE POLICY trade_screenshots_self_read
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trade_screenshots_self_write'
  ) THEN
    CREATE POLICY trade_screenshots_self_write
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

    CREATE POLICY trade_screenshots_self_update
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

    CREATE POLICY trade_screenshots_self_delete
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
