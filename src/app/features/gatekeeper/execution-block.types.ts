import type { AssetSymbol, DayType, HtfContextSnapshot, TradeDirection, TradeSessionContext } from '../../core/models/database.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';

export interface ExecutionFormValue {
  symbol: AssetSymbol;
  direction: TradeDirection;
  day_type: DayType;
  entry_price: number;
  stop_price: number;
  size: number;
  target_price: number | null;
  notes: string | null;
}

export interface ExecutionRiskMetrics {
  stopDistancePts: number;
  risk_per_contract: number;
  total_risk: number;
  r_target: number | null;
}

export interface GatekeeperSubmitPayload {
  trade: {
    symbol: AssetSymbol;
    direction: TradeDirection;
    day_type: DayType;
    entry_price: number;
    stop_price: number;
    size: number;
    notes: string | null;
    trading_date: string;
    session_context: TradeSessionContext;
    status: 'OPEN';
    readiness_pct_at_entry: 100;
  };
  audit: {
    location: NonNullable<GatekeeperFormValue['location']['location']>;
    behavior: NonNullable<GatekeeperFormValue['behavior']['behavior']>;
    confirmation: NonNullable<GatekeeperFormValue['confirmation']['confirmation']>;
    invalidation_level: string;
    invalidation_price: number;
    is_retest: true;
    location_thesis: string;
    behavior_thesis: string;
    confirmation_thesis: string;
    invalidation_thesis: string;
    htf_context: HtfContextSnapshot;
  };
}

export interface GatekeeperSubmitResult {
  tradeId: string;
  auditId: string;
}
