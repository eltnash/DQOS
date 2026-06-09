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
  | 'Session_VWAP'
  | 'Anchored_VWAP'
  | 'Composite_VAH'
  | 'Composite_VAL'
  | 'Composite_POC'
  | 'Overnight_High'
  | 'Overnight_Low'
  | 'Prior_Day_High'
  | 'Prior_Day_Low'
  | 'Single_Print'
  | 'Naked_POC'
  | 'Order_Block'
  | 'Fair_Value_Gap'
  | 'HVN'
  | 'LVN';
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
  | 'CVD_Alignment'
  | 'Delta_Shift'
  | 'Volume_Absorption'
  | 'Excess_Tail'
  | 'VWAP_Reclaim'
  | 'VWAP_Acceptance'
  | 'VWAP_Rejection'
  | 'Anchored_VWAP_Hold'
  | 'POC_Rejection'
  | 'VA_Edge_Rejection'
  | 'Value_Area_Acceptance'
  | 'Market_Structure_Break';

/** Timeframes reviewed before dropping to execution TF (15m). */
export type AnalyzedTimeframe = 'M' | 'W' | 'D' | 'H4' | 'H1';

/** Primary execution timeframe for gatekeeper HTF context step. */
export type TradingTimeframe = 'M15';

/** LTF focus for each execution pillar (location, behavior, confirmation, invalidation). */
export type PillarFocusTimeframe = 'M15' | 'M5' | 'M1';

export type PillarStepKey = 'location' | 'behavior' | 'confirmation' | 'invalidation';

export type CompositeValuePosition = 'Above_VA' | 'Below_VA' | 'Inside_VA';

export type HtfAuctionRegime =
  | 'Breaking_Balance'
  | 'Rotating_Balance'
  | 'Repairing_Structure'
  | 'Migrating_To_Composite_POC';

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
  | 'Unfinished_Business'
  | 'Market_Structure_Trendlines'
  | 'Prior_Week_HL_Lines';

/** Where the developing week is trading relative to the prior week's candle. */
export type PriorWeekRangePosition =
  | 'Inside_Prior_Week'
  | 'Breaking_Prior_Week_High'
  | 'Breaking_Prior_Week_Low';

export interface WeeklyRangeContext {
  current_week_position: PriorWeekRangePosition;
}

export interface TimeframeScreenshotRef {
  storage_path: string;
  file_name: string;
  mime_type: string;
  is_annotated: boolean;
}

export interface JournalNoteTag {
  id: string;
  label: string;
  start: number;
  end: number;
}

/** Per-timeframe chart journal before 15m execution. */
export interface TimeframeJournalEntry {
  timeframe: AnalyzedTimeframe;
  notes: string;
  note_tags: JournalNoteTag[];
  screenshots: TimeframeScreenshotRef[];
  narrative: HtfNarrativeSnapshot;
}

/** HTF narrative Q&A captured per analyzed timeframe. */
export interface HtfNarrativeSnapshot {
  value_migration: string;
  composite_va_position: CompositeValuePosition;
  auction_regime: HtfAuctionRegime;
  prior_week_range_position?: PriorWeekRangePosition | null;
  tools_used: HtfAnalysisTool[];
  htf_trade_posture: string;
  session_read?: string;
}

export interface HtfContextSnapshot {
  trading_timeframe: TradingTimeframe;
  timeframe_entries: TimeframeJournalEntry[];
}

export interface PillarStepJournal {
  focus_timeframe: PillarFocusTimeframe;
  notes: string;
  note_tags: JournalNoteTag[];
  screenshots: TimeframeScreenshotRef[];
}

export interface PillarJournalsSnapshot {
  location: PillarStepJournal;
  behavior: PillarStepJournal;
  confirmation: PillarStepJournal;
  invalidation: PillarStepJournal;
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
  locations: AuctionLocation[];
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
  pillar_journals: PillarJournalsSnapshot;
  location_valid_post: boolean | null;
  behavior_matched_post: boolean | null;
  confirmation_legitimate_post: boolean | null;
  invalidation_respected_post: boolean | null;
  execution_error: boolean;
  edge_failure: boolean;
  post_mortem_completed_at: string | null;
}
