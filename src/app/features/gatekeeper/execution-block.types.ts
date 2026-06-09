import type { AssetSymbol, DayType, HtfContextSnapshot, PillarJournalsSnapshot, PlatformOrderType, TradeDirection, TradeSessionContext } from '../../core/models/database.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';

/**
 * MT5-aligned trade record for one journal (manual entry from platform history).
 * Column names mirror MetaTrader trade history for easy copy-from-platform workflow.
 */
export interface ExecutionFormValue {
  /** Platform order / deal ticket (MT5: Ticket) */
  ticket: string | null;
  symbol: AssetSymbol;
  /** MT5 Type — market, limit, stop, etc. */
  order_type: PlatformOrderType;
  /** Buy/sell side — explicit for market execution; derived for limit/stop types */
  direction: TradeDirection;
  /** MT5 Volume (lots) */
  volume: number | null;
  /** MT5 Time (entry) — ISO 8601 */
  entry_time: string | null;
  /** MT5 Price (entry) */
  entry_price: number | null;
  /** MT5 S/L */
  stop_price: number | null;
  /** MT5 T/P */
  take_profit_price: number | null;
  /** MT5 Time (exit) — ISO 8601 */
  exit_time: string | null;
  /** MT5 Price (exit) */
  exit_price: number | null;
  /** MT5 Commission */
  commission: number | null;
  /** MT5 Fee */
  fee: number | null;
  /** MT5 Swap */
  swap: number | null;
  /** MT5 Profit */
  profit: number | null;
  /** MT5 Comment */
  comment: string | null;
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
    status: 'OPEN' | 'CLOSED';
    readiness_pct_at_entry: 100;
    opened_at?: string;
    closed_at?: string | null;
    exit_price?: number | null;
    commissions?: number;
    net_profit?: number | null;
  };
  audit: {
    location: GatekeeperFormValue['location']['locations'][number];
    locations: GatekeeperFormValue['location']['locations'];
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
    pillar_journals: PillarJournalsSnapshot;
  };
}

export interface GatekeeperSubmitResult {
  tradeId: string;
  auditId: string;
}
