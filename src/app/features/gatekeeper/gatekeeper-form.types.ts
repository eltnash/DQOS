import type {
  AnalyzedTimeframe,
  AuctionLocation,
  CompositeValuePosition,
  ConfirmationTrigger,
  DayType,
  HtfAnalysisTool,
  HtfAuctionRegime,
  MarketBehavior,
  PillarFocusTimeframe,
  TradingTimeframe,
} from '../../core/models/database.types';
import type { TaggedNotesValue } from '../../shared/components/tagged-notes-editor/tagged-notes.types';

export interface TimeframeJournalFormValue {
  notes_content: TaggedNotesValue;
}

export interface HtfNarrativeFormValue {
  value_migration: string;
  composite_va_position: CompositeValuePosition | null;
  auction_regime: HtfAuctionRegime | null;
  tools_used: Record<HtfAnalysisTool, boolean>;
  htf_trade_posture: string;
  session_read: string;
}

export interface ContextStepValue {
  narrative: HtfNarrativeFormValue;
  analyzed_timeframes: Record<AnalyzedTimeframe, boolean>;
  trading_timeframe: TradingTimeframe;
  timeframe_journals: Record<AnalyzedTimeframe, TimeframeJournalFormValue>;
}

export interface AuctionTypeStepValue {
  day_type: DayType | null;
}

export interface PillarStepFormValue {
  focus_timeframe: PillarFocusTimeframe;
  notes_content: TaggedNotesValue;
}

export interface LocationStepValue extends PillarStepFormValue {
  location: AuctionLocation | null;
}

export interface BehaviorStepValue extends PillarStepFormValue {
  behavior: MarketBehavior | null;
}

export interface ConfirmationStepValue extends PillarStepFormValue {
  confirmation: ConfirmationTrigger | null;
}

export interface InvalidationStepValue extends PillarStepFormValue {
  invalidation_level: string;
  invalidation_price: number | null;
}

export interface GatekeeperFormValue {
  context: ContextStepValue;
  auction_type: AuctionTypeStepValue;
  is_retest: boolean;
  location: LocationStepValue;
  behavior: BehaviorStepValue;
  confirmation: ConfirmationStepValue;
  invalidation: InvalidationStepValue;
}

export type GatekeeperStepKey =
  | 'context'
  | 'auction_type'
  | 'location'
  | 'behavior'
  | 'confirmation'
  | 'invalidation';

export type ExecutionPillarStepKey = Exclude<GatekeeperStepKey, 'context' | 'auction_type'>;
