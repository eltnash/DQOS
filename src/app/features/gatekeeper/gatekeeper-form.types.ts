import type {
  AnalyzedTimeframe,
  AuctionLocation,
  CompositeValuePosition,
  ConfirmationTrigger,
  HtfAnalysisTool,
  HtfAuctionRegime,
  MarketBehavior,
  MarketStructureBias,
  PriorWeekRangePosition,
  TradingTimeframe,
} from '../../core/models/database.types';

export interface ContextStepValue {
  analyzed_timeframes: Record<AnalyzedTimeframe, boolean>;
  trading_timeframe: TradingTimeframe;
  prior_week_range_position: PriorWeekRangePosition | null;
  composite_value_position: CompositeValuePosition | null;
  auction_regime: HtfAuctionRegime | null;
  structure_bias: MarketStructureBias | null;
  tools_used: Record<HtfAnalysisTool, boolean>;
  htf_thesis: string;
  session_posture: string;
}

export interface LocationStepValue {
  location: AuctionLocation | null;
  location_thesis: string;
}

export interface BehaviorStepValue {
  behavior: MarketBehavior | null;
  behavior_thesis: string;
}

export interface ConfirmationStepValue {
  confirmation: ConfirmationTrigger | null;
  confirmation_thesis: string;
}

export interface InvalidationStepValue {
  invalidation_level: string;
  invalidation_price: number | null;
  invalidation_thesis: string;
}

export interface GatekeeperFormValue {
  context: ContextStepValue;
  is_retest: boolean;
  location: LocationStepValue;
  behavior: BehaviorStepValue;
  confirmation: ConfirmationStepValue;
  invalidation: InvalidationStepValue;
}

export type GatekeeperStepKey =
  | 'context'
  | 'location'
  | 'behavior'
  | 'confirmation'
  | 'invalidation';
