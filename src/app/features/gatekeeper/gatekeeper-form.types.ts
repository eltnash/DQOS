import type {
  AnalyzedTimeframe,
  AuctionLocation,
  ConfirmationTrigger,
  MarketBehavior,
  TradingTimeframe,
} from '../../core/models/database.types';
import type { TaggedNotesValue } from '../../shared/components/tagged-notes-editor/tagged-notes.types';

export interface TimeframeJournalFormValue {
  notes_content: TaggedNotesValue;
}

export interface ContextStepValue {
  analyzed_timeframes: Record<AnalyzedTimeframe, boolean>;
  trading_timeframe: TradingTimeframe;
  timeframe_journals: Record<AnalyzedTimeframe, TimeframeJournalFormValue>;
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
