-- Run once in Supabase Dashboard → SQL Editor → New query
-- Project: pgxxsivodspkycdvcpur (Mraai)

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
