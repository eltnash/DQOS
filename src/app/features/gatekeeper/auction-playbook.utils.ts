import type {
  AuctionLocation,
  ConfirmationTrigger,
  DayType,
  MarketBehavior,
} from '../../core/models/database.types';
import type { SelectOption } from '../../core/supabase/enum-options';
import {
  AUCTION_LOCATION_OPTIONS,
  CONFIRMATION_TRIGGER_OPTIONS,
  DAY_TYPE_OPTIONS,
  MARKET_BEHAVIOR_OPTIONS,
} from '../../core/supabase/enum-options';

export type AuctionPlaybook = 'fade' | 'trend';

/** Auction Type step — developing vs prior session volume profile guidance. */
export const AUCTION_TYPE_PROFILE_REMINDER =
  'At the open, do not classify the developing day\'s volume profile. With little volume logged, POC, VAH, and VAL chase price instead of defining it. Anchor early reads to the prior session\'s completed profile (POC / VAH / VAL). Treat today\'s profile as decision grade only once structure has built: levels stop shifting with every print, and price reacts to them rather than the reverse. Update your day type read as the session matures.';

const FADE_LOCATIONS: AuctionLocation[] = [
  'VAH',
  'VAL',
  'POC',
  'Session_VWAP',
  'Composite_VAH',
  'Composite_VAL',
  'Composite_POC',
  'Overnight_High',
  'Overnight_Low',
  'Prior_Day_High',
  'Prior_Day_Low',
  'Single_Print',
  'Naked_POC',
  'HVN',
  'LVN',
];

const TREND_LOCATIONS: AuctionLocation[] = [
  'Session_VWAP',
  'Anchored_VWAP',
  'VAH',
  'VAL',
  'POC',
  'Prior_Day_High',
  'Prior_Day_Low',
  'Overnight_High',
  'Overnight_Low',
  'Order_Block',
  'Fair_Value_Gap',
  'LVN',
  'Single_Print',
  'HVN',
];

const FADE_BEHAVIORS: MarketBehavior[] = [
  'Rejection',
  'Rotation',
  'Exhaustion',
  'Excess',
  'Failed_Auction',
  'Responsive_Buying',
  'Responsive_Selling',
];

const TREND_BEHAVIORS: MarketBehavior[] = [
  'Acceptance',
  'Value_Migration',
  'Responsive_Buying',
  'Responsive_Selling',
  'Exhaustion',
  'Excess',
];

const FADE_CONFIRMATIONS: ConfirmationTrigger[] = [
  'Delta_Divergence',
  'Volume_Absorption',
  'Excess_Tail',
  'VWAP_Reclaim',
];

const TREND_CONFIRMATIONS: ConfirmationTrigger[] = [
  'VWAP_Reclaim',
  'Market_Structure_Break',
  'Volume_Absorption',
  'Delta_Divergence',
];

export function playbookForDayType(dayType: DayType): AuctionPlaybook {
  switch (dayType) {
    case 'Trend_Day':
    case 'Double_Dist':
      return 'trend';
    default:
      return 'fade';
  }
}

export function playbookLabel(playbook: AuctionPlaybook): string {
  return playbook === 'fade' ? 'Mean-reversion playbook' : 'Trend-following playbook';
}

export function playbookDescription(playbook: AuctionPlaybook): string {
  if (playbook === 'fade') {
    return 'The auction prefers rotation around value. Fade profile edges, prior highs/lows, and LVNs — lean on VWAP and POC as magnets with order flow confirmation.';
  }
  return 'The auction is migrating directionally. Join pullbacks to VWAP, broken structure, or LVNs — do not fade each extension; treat VWAP as dynamic support/resistance in trend.';
}

export function invalidationPlaceholder(playbook: AuctionPlaybook): string {
  if (playbook === 'fade') {
    return 'e.g. Acceptance beyond VAH/VAL with value migration — fade thesis dead';
  }
  return 'e.g. Acceptance back inside prior value / failed retest of broken IB edge';
}

export function dayTypeLabel(dayType: DayType): string {
  const option = DAY_TYPE_OPTIONS.find((item) => item.value === dayType);
  return option?.label ?? dayType;
}

export function filterOptions<T extends string>(
  all: SelectOption<T>[],
  allowed: readonly T[],
): SelectOption<T>[] {
  const allowedSet = new Set<string>(allowed);
  return all.filter((option) => allowedSet.has(option.value));
}

export function getPlaybookLocationOptions(playbook: AuctionPlaybook): SelectOption<AuctionLocation>[] {
  return filterOptions(
    AUCTION_LOCATION_OPTIONS,
    playbook === 'fade' ? FADE_LOCATIONS : TREND_LOCATIONS,
  );
}

export function getPlaybookBehaviorOptions(playbook: AuctionPlaybook): SelectOption<MarketBehavior>[] {
  return filterOptions(
    MARKET_BEHAVIOR_OPTIONS,
    playbook === 'fade' ? FADE_BEHAVIORS : TREND_BEHAVIORS,
  );
}

export function getPlaybookConfirmationOptions(
  playbook: AuctionPlaybook,
): SelectOption<ConfirmationTrigger>[] {
  return filterOptions(
    CONFIRMATION_TRIGGER_OPTIONS,
    playbook === 'fade' ? FADE_CONFIRMATIONS : TREND_CONFIRMATIONS,
  );
}
