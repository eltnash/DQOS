-- Per-pillar chart journals (screenshots, tags, LTF focus timeframe)
ALTER TABLE public.execution_audits
ADD COLUMN IF NOT EXISTS pillar_journals JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.execution_audits.pillar_journals IS
  'Location/behavior/confirmation/invalidation journals: focus_timeframe (M15|M5|M1), notes, tags, screenshot refs';
