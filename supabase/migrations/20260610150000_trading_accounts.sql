-- Trading accounts: isolated workspaces per user (OneNote-style notebooks; not separate logins).
DO $$ BEGIN
  CREATE TYPE public.trading_account_type AS ENUM ('demo', 'live');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type public.trading_account_type NOT NULL DEFAULT 'demo',
  currency TEXT NOT NULL DEFAULT 'USD',
  starting_capital NUMERIC(18, 2),
  current_balance NUMERIC(18, 2),
  max_drawdown_pct NUMERIC(5, 2),
  daily_drawdown_pct NUMERIC(5, 2),
  configured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trading_accounts_user_list_idx
  ON public.trading_accounts (user_id, updated_at DESC);

COMMENT ON TABLE public.trading_accounts IS
  'User-named trading workspaces with isolated capital, journals, and trades — not separate auth logins.';

CREATE TRIGGER trading_accounts_set_updated_at
  BEFORE UPDATE ON public.trading_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trading_accounts' AND policyname = 'trading_accounts_self'
  ) THEN
    CREATE POLICY trading_accounts_self
    ON public.trading_accounts FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Scope trades and journals to an account.
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.gatekeeper_drafts
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS trades_account_id_idx ON public.trades (account_id);
CREATE INDEX IF NOT EXISTS gatekeeper_drafts_account_id_idx ON public.gatekeeper_drafts (account_id);

-- Backfill: one default account per user with orphan rows.
INSERT INTO public.trading_accounts (user_id, name, account_type)
SELECT DISTINCT user_id, 'Default Account', 'demo'::public.trading_account_type
FROM (
  SELECT user_id FROM public.trades WHERE account_id IS NULL
  UNION
  SELECT user_id FROM public.gatekeeper_drafts WHERE account_id IS NULL
) AS orphan_users
WHERE NOT EXISTS (
  SELECT 1 FROM public.trading_accounts ta
  WHERE ta.user_id = orphan_users.user_id AND ta.name = 'Default Account'
);

UPDATE public.trades t
SET account_id = ta.id
FROM public.trading_accounts ta
WHERE t.account_id IS NULL
  AND ta.user_id = t.user_id
  AND ta.name = 'Default Account';

UPDATE public.gatekeeper_drafts g
SET account_id = ta.id
FROM public.trading_accounts ta
WHERE g.account_id IS NULL
  AND ta.user_id = g.user_id
  AND ta.name = 'Default Account';

-- Journal names unique per account (not per user).
DROP INDEX IF EXISTS gatekeeper_drafts_user_journal_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS gatekeeper_drafts_account_journal_name_unique
  ON public.gatekeeper_drafts (account_id, journal_name)
  WHERE account_id IS NOT NULL;
