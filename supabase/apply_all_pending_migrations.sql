-- Mraai — apply all pending Gatekeeper migrations (idempotent)
-- Run in Supabase Dashboard → SQL Editor for project pgxxsivodspkycdvcpur
-- Or: npx supabase login && npx supabase link --project-ref pgxxsivodspkycdvcpur && npx supabase db push

-- ---------------------------------------------------------------------------
-- 0. Utility
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. Enum extensions (auction_location + asset_symbol)
-- ---------------------------------------------------------------------------
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'EURUSD';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'GBPUSD';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'USDJPY';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'AUDUSD';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'USDCAD';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'USDCHF';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'NZDUSD';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'EURGBP';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'EURJPY';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'GBPJPY';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'XAUUSD';
ALTER TYPE public.asset_symbol ADD VALUE IF NOT EXISTS 'XAGUSD';

ALTER TYPE public.auction_location ADD VALUE IF NOT EXISTS 'Session_VWAP';
ALTER TYPE public.auction_location ADD VALUE IF NOT EXISTS 'Anchored_VWAP';
ALTER TYPE public.auction_location ADD VALUE IF NOT EXISTS 'Prior_Day_High';
ALTER TYPE public.auction_location ADD VALUE IF NOT EXISTS 'Prior_Day_Low';
ALTER TYPE public.auction_location ADD VALUE IF NOT EXISTS 'Order_Block';
ALTER TYPE public.auction_location ADD VALUE IF NOT EXISTS 'Fair_Value_Gap';
ALTER TYPE public.auction_location ADD VALUE IF NOT EXISTS 'HVN';
ALTER TYPE public.auction_location ADD VALUE IF NOT EXISTS 'LVN';

-- ---------------------------------------------------------------------------
-- 2. HTF context on execution_audits
-- ---------------------------------------------------------------------------
ALTER TABLE public.execution_audits
  ADD COLUMN IF NOT EXISTS htf_context JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.execution_audits.htf_context IS
  'Higher timeframe auction context: analyzed TFs, composite VA position, structure bias, tools, narratives';

-- ---------------------------------------------------------------------------
-- 3. Trading session on trades
-- ---------------------------------------------------------------------------
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS trading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS session_context JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.trades.trading_date IS 'Calendar trading day this Gatekeeper session applies to';
COMMENT ON COLUMN public.trades.session_context IS 'Market session, analysis period, recorded timestamp, timezone';

-- ---------------------------------------------------------------------------
-- 4. Screenshot storage bucket + RLS
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trade_screenshots_select_own'
  ) THEN
    CREATE POLICY "trade_screenshots_select_own"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trade_screenshots_insert_own'
  ) THEN
    CREATE POLICY "trade_screenshots_insert_own"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trade_screenshots_delete_own'
  ) THEN
    CREATE POLICY "trade_screenshots_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Pillar journals on execution_audits
-- ---------------------------------------------------------------------------
ALTER TABLE public.execution_audits
  ADD COLUMN IF NOT EXISTS pillar_journals JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.execution_audits.pillar_journals IS
  'Location/behavior/confirmation/invalidation journals: focus_timeframe (M15|M5|M1), notes, tags, screenshot refs';

-- ---------------------------------------------------------------------------
-- 6. Gatekeeper drafts (autosave + screenshot refs)
-- ---------------------------------------------------------------------------
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

CREATE UNIQUE INDEX IF NOT EXISTS gatekeeper_drafts_session_unique
  ON public.gatekeeper_drafts (
    user_id,
    trading_date,
    symbol,
    (session_context->>'market_session'),
    (session_context->>'analysis_period')
  );

COMMENT ON TABLE public.gatekeeper_drafts IS
  'Autosaved Gatekeeper wizard state per trading session — promoted to trades on execution submit';

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

-- ---------------------------------------------------------------------------
-- 7. Multiple location tags on execution_audits
-- ---------------------------------------------------------------------------
ALTER TABLE public.execution_audits
  ADD COLUMN IF NOT EXISTS locations public.auction_location[] NOT NULL DEFAULT '{}'::public.auction_location[];

COMMENT ON COLUMN public.execution_audits.locations IS
  'All selected location tags at qualification; location column keeps the primary (first) tag for legacy queries';

UPDATE public.execution_audits
SET locations = ARRAY[location]
WHERE cardinality(locations) = 0;

-- ---------------------------------------------------------------------------
-- 8. Named Gatekeeper journals (unique per user)
-- ---------------------------------------------------------------------------
ALTER TABLE public.gatekeeper_drafts
  ADD COLUMN IF NOT EXISTS journal_name TEXT;

UPDATE public.gatekeeper_drafts
SET journal_name = 'Session ' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')
WHERE journal_name IS NULL OR btrim(journal_name) = '';

ALTER TABLE public.gatekeeper_drafts
  ALTER COLUMN journal_name SET NOT NULL;

DROP INDEX IF EXISTS gatekeeper_drafts_session_unique;

CREATE UNIQUE INDEX IF NOT EXISTS gatekeeper_drafts_user_journal_name_unique
  ON public.gatekeeper_drafts (user_id, journal_name);

COMMENT ON COLUMN public.gatekeeper_drafts.journal_name IS
  'User-chosen unique label for this in-progress Gatekeeper journal; shown on Journal tab';
