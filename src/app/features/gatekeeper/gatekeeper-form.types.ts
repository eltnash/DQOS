import type {
  AuctionLocation,
  ConfirmationTrigger,
  MarketBehavior,
} from '../../core/models/database.types';

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
  is_retest: boolean;
  location: LocationStepValue;
  behavior: BehaviorStepValue;
  confirmation: ConfirmationStepValue;
  invalidation: InvalidationStepValue;
}

export type GatekeeperStepKey = 'location' | 'behavior' | 'confirmation' | 'invalidation';
