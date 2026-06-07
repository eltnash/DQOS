-- Trading session context + expanded instrument symbols
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS trading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS session_context JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.trades.trading_date IS 'Calendar trading day this Gatekeeper session applies to';
COMMENT ON COLUMN public.trades.session_context IS 'Market session, analysis period, recorded timestamp, timezone';

ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'EURUSD';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'GBPUSD';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'USDJPY';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'AUDUSD';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'USDCAD';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'USDCHF';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'NZDUSD';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'EURGBP';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'EURJPY';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'GBPJPY';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'XAUUSD';
ALTER TYPE asset_symbol ADD VALUE IF NOT EXISTS 'XAGUSD';
