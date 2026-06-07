import type {
  AnalyzedTimeframe,
  AuctionLocation,
  ConfirmationTrigger,
  MarketBehavior,
  PillarFocusTimeframe,
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

export type ExecutionPillarStepKey = Exclude<GatekeeperStepKey, 'context'>;
