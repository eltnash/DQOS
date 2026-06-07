export type AssetSymbol =
  | 'ES'
  | 'NQ'
  | 'RTY'
  | 'YM'
  | 'CL'
  | 'GC'
  | 'SI'
  | 'ZB'
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDJPY'
  | 'AUDUSD'
  | 'USDCAD'
  | 'USDCHF'
  | 'NZDUSD'
  | 'EURGBP'
  | 'EURJPY'
  | 'GBPJPY'
  | 'XAUUSD'
  | 'XAGUSD';
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

/** Timeframes reviewed before dropping to execution TF (15m). */
export type AnalyzedTimeframe = 'M' | 'W' | 'D' | 'H4' | 'H1';

/** Primary execution timeframe for gatekeeper pillars. */
export type TradingTimeframe = 'M15';

export type CompositeValuePosition = 'Above_VA' | 'Below_VA' | 'Inside_VA';

export type HtfAuctionRegime =
  | 'Breaking_Balance'
  | 'Rotating_Balance'
  | 'Repairing_Structure';

export type MarketStructureBias =
  | 'Bullish_HH_HL'
  | 'Bearish_LH_LL'
  | 'Balance_Range'
  | 'Transitional_BOS';

export type HtfAnalysisTool =
  | 'Composite_VP'
  | 'Multi_Day_VAH_VAL_POC'
  | 'Major_HVN_LVN'
  | 'Multi_Day_TPO'
  | 'Value_Area_Migration'
  | 'Day_Type_Series'
  | 'Unfinished_Business';

/** Where the developing week is trading relative to the prior week's candle. */
export type PriorWeekRangePosition =
  | 'Inside_Prior_Week'
  | 'Breaking_Prior_Week_High'
  | 'Breaking_Prior_Week_Low';

export interface WeeklyRangeContext {
  current_week_position: PriorWeekRangePosition;
}

export interface HtfContextSnapshot {
  analyzed_timeframes: AnalyzedTimeframe[];
  trading_timeframe: TradingTimeframe;
  composite_value_position: CompositeValuePosition;
  auction_regime: HtfAuctionRegime;
  structure_bias: MarketStructureBias;
  tools_used: HtfAnalysisTool[];
  htf_thesis: string;
  session_posture: string;
  weekly_range: WeeklyRangeContext | null;
}

export type MarketSession = 'Asia' | 'London' | 'New_York';
export type AnalysisPeriod = 'Morning' | 'Afternoon' | 'Night';

export interface TradeSessionContext {
  trading_date: string;
  market_session: MarketSession;
  analysis_period: AnalysisPeriod;
  analysis_recorded_at: string;
  timezone: string;
}

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
  trading_date: string;
  session_context: TradeSessionContext;
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
  htf_context: HtfContextSnapshot;
  location_valid_post: boolean | null;
  behavior_matched_post: boolean | null;
  confirmation_legitimate_post: boolean | null;
  invalidation_respected_post: boolean | null;
  execution_error: boolean;
  edge_failure: boolean;
  post_mortem_completed_at: string | null;
}
