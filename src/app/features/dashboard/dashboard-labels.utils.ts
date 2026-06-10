import {
  AUCTION_LOCATION_OPTIONS,
  AUCTION_STRATEGY_OPTIONS,
  CONFIRMATION_TRIGGER_OPTIONS,
  DAY_TYPE_OPTIONS,
  MARKET_BEHAVIOR_OPTIONS,
} from '../../core/supabase/enum-options';
import type {
  AuctionLocation,
  AuctionStrategy,
  ConfirmationTrigger,
  DayType,
  MarketBehavior,
} from '../../core/models/database.types';

function labelFrom<T extends string>(
  options: { label: string; value: T }[],
  value: T | null | undefined,
): string {
  if (!value) {
    return 'Unknown';
  }
  return options.find((o) => o.value === value)?.label ?? value;
}

export const locationLabel = (v: AuctionLocation | null | undefined) =>
  labelFrom(AUCTION_LOCATION_OPTIONS, v ?? undefined);

export const behaviorLabel = (v: MarketBehavior | null | undefined) =>
  labelFrom(MARKET_BEHAVIOR_OPTIONS, v ?? undefined);

export const confirmationLabel = (v: ConfirmationTrigger | null | undefined) =>
  labelFrom(CONFIRMATION_TRIGGER_OPTIONS, v ?? undefined);

export const strategyLabel = (v: AuctionStrategy | null | undefined) =>
  labelFrom(AUCTION_STRATEGY_OPTIONS, v ?? undefined);

export const dayTypeLabel = (v: DayType | null | undefined) =>
  labelFrom(DAY_TYPE_OPTIONS, v ?? undefined);
