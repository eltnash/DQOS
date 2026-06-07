import type { AssetSymbol, AnalysisPeriod, MarketSession, TradeSessionContext } from '../../core/models/database.types';

export type { AnalysisPeriod, MarketSession, TradeSessionContext };

export interface TradingSessionFormValue {
  trading_date: Date | null;
  market_session: MarketSession | null;
  analysis_period: AnalysisPeriod | null;
  analysis_recorded_at: Date | null;
  timezone: string;
  symbol: AssetSymbol | null;
}

export interface TradingSessionState {
  session: TradeSessionContext;
  symbol: AssetSymbol;
}

export interface TradingSessionChangeEvent {
  valid: boolean;
  state: TradingSessionState | null;
}
