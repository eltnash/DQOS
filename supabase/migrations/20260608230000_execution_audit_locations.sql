-- Allow multiple auction locations per execution audit (Location pillar)
ALTER TABLE public.execution_audits
  ADD COLUMN IF NOT EXISTS locations auction_location[] NOT NULL DEFAULT '{}'::auction_location[];

COMMENT ON COLUMN public.execution_audits.locations IS
  'All selected location tags at qualification; location column keeps the primary (first) tag for legacy queries';

UPDATE public.execution_audits
SET locations = ARRAY[location]
WHERE cardinality(locations) = 0;
