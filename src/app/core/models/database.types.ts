export type AssetSymbol = 'ES' | 'NQ' | 'RTY' | 'YM' | 'CL' | 'GC' | 'SI' | 'ZB';
export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type DayType = 'D_Day' | 'P_Day' | 'b_Day' | 'Trend_Day' | 'Double_Dist';
export type AuctionLocation =
  | 'VAH'
  | 'VAL'
  | 'POC'
  | 'Weekly_VWAP'
  | 'Monthly_VWAP'
  | 'Composite_VAH'
  | 'Composite_VAL'
  | 'Composite_POC'
  | 'Overnight_High'
  | 'Overnight_Low'
  | 'Single_Print'
  | 'Naked_POC';
export type MarketBehavior =
  | 'Rejection'
  | 'Acceptance'
  | 'Rotation'
  | 'Exhaustion'
  | 'Excess'
  | 'Failed_Auction'
  | 'Value_Migration'
  | 'Responsive_Buying'
  | 'Responsive_Selling';
export type ConfirmationTrigger =
  | 'Delta_Divergence'
  | 'Volume_Absorption'
  | 'Excess_Tail'
  | 'VWAP_Reclaim'
  | 'Market_Structure_Break';

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  setup_id: string | null;
  status: TradeStatus;
  symbol: AssetSymbol;
  direction: TradeDirection;
  day_type: DayType;
  opened_at: string;
  closed_at: string | null;
  entry_price: number | null;
  stop_price: number | null;
  exit_price: number | null;
  size: number | null;
  commissions: number;
  net_profit: number | null;
  r_multiple: number | null;
  tqs: number | null;
  process_compliance_pct: number | null;
  readiness_pct_at_entry: number;
}

export interface ExecutionAudit {
  id: string;
  trade_id: string;
  location: AuctionLocation;
  behavior: MarketBehavior;
  confirmation: ConfirmationTrigger;
  invalidation_level: string;
  invalidation_price: number;
  is_retest: boolean;
  location_thesis: string;
  behavior_thesis: string;
  confirmation_thesis: string;
  invalidation_thesis: string;
  location_valid_post: boolean | null;
  behavior_matched_post: boolean | null;
  confirmation_legitimate_post: boolean | null;
  invalidation_respected_post: boolean | null;
  execution_error: boolean;
  edge_failure: boolean;
  post_mortem_completed_at: string | null;
}
