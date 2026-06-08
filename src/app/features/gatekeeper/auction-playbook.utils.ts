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
  LOCATION_PILLAR_OPTIONS,
  MARKET_BEHAVIOR_OPTIONS,
} from '../../core/supabase/enum-options';

export type AuctionPlaybook = 'fade' | 'trend' | 'contextual';

/** Auction Type step — developing vs prior session volume profile guidance. */
export const AUCTION_TYPE_PROFILE_REMINDER =
  'At the open, do not classify the developing day\'s volume profile. With little volume logged, POC, VAH, and VAL chase price instead of defining it. Anchor early reads to the prior session\'s completed profile (POC / VAH / VAL). Treat today\'s profile as decision grade only once structure has built: levels stop shifting with every print, and price reacts to them rather than the reverse. Update your day type read as the session matures.';

const FADE_LOCATIONS: AuctionLocation[] = [
  'VAH',
  'VAL',
  'Session_VWAP',
  'Anchored_VWAP',
  'LVN',
  'Order_Block',
  'POC',
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

const CONTEXTUAL_LOCATIONS: AuctionLocation[] = [
  ...new Set<AuctionLocation>([...FADE_LOCATIONS, ...TREND_LOCATIONS]),
];

const CONTEXTUAL_BEHAVIORS: MarketBehavior[] = [
  ...new Set<MarketBehavior>([...FADE_BEHAVIORS, ...TREND_BEHAVIORS]),
];

const CONTEXTUAL_CONFIRMATIONS: ConfirmationTrigger[] = [
  ...new Set<ConfirmationTrigger>([...FADE_CONFIRMATIONS, ...TREND_CONFIRMATIONS]),
];

function playbookLocations(playbook: AuctionPlaybook): readonly AuctionLocation[] {
  if (playbook === 'contextual') {
    return CONTEXTUAL_LOCATIONS;
  }
  return playbook === 'fade' ? FADE_LOCATIONS : TREND_LOCATIONS;
}

function playbookBehaviors(playbook: AuctionPlaybook): readonly MarketBehavior[] {
  if (playbook === 'contextual') {
    return CONTEXTUAL_BEHAVIORS;
  }
  return playbook === 'fade' ? FADE_BEHAVIORS : TREND_BEHAVIORS;
}

function playbookConfirmations(playbook: AuctionPlaybook): readonly ConfirmationTrigger[] {
  if (playbook === 'contextual') {
    return CONTEXTUAL_CONFIRMATIONS;
  }
  return playbook === 'fade' ? FADE_CONFIRMATIONS : TREND_CONFIRMATIONS;
}

export function playbookForDayType(dayType: DayType): AuctionPlaybook {
  switch (dayType) {
    case 'Trend_Day':
    case 'Double_Dist':
      return 'trend';
    case 'P_Day':
    case 'b_Day':
      return 'contextual';
    default:
      return 'fade';
  }
}

export function playbookLabel(playbook: AuctionPlaybook): string {
  if (playbook === 'fade') {
    return 'Mean-reversion playbook';
  }
  if (playbook === 'trend') {
    return 'Trend-following playbook';
  }
  return 'Shape + context playbook';
}

export function playbookTagSeverity(playbook: AuctionPlaybook): 'info' | 'success' | 'warn' {
  if (playbook === 'fade') {
    return 'info';
  }
  if (playbook === 'trend') {
    return 'success';
  }
  return 'warn';
}

export function playbookDescription(playbook: AuctionPlaybook, dayType?: DayType | null): string {
  if (playbook === 'contextual') {
    if (dayType === 'P_Day') {
      return 'Upper-heavy acceptance shows where volume built, not an automatic fade. With HTF up, this can be continuation balance above prior value; into resistance it can invite rotation lower. Trade the retest at the heavy upper value for rejection, acceptance, or migration. Do not trade the letter alone.';
    }
    if (dayType === 'b_Day') {
      return 'Lower-heavy acceptance shows where volume built, not an automatic fade. With HTF down, this can be continuation balance below prior value; into support it can invite rotation higher. Trade the retest at the heavy lower value for rejection, acceptance, or migration. Do not trade the letter alone.';
    }
    return 'Profile shape shows where acceptance built. Match your playbook to HTF posture and retest behavior. Do not assume mean reversion or trend by shape alone.';
  }

  if (playbook === 'fade') {
    return 'The auction prefers rotation around value. Fade profile edges, prior highs/lows, and LVNs — lean on VWAP and POC as magnets with order flow confirmation.';
  }

  return 'The auction is migrating directionally. Join pullbacks to VWAP, broken structure, or LVNs — do not fade each extension; treat VWAP as dynamic support/resistance in trend.';
}

export function invalidationPlaceholder(playbook: AuctionPlaybook): string {
  if (playbook === 'fade') {
    return 'e.g. Acceptance beyond VAH/VAL with value migration — fade thesis dead';
  }
  if (playbook === 'trend') {
    return 'e.g. Acceptance back inside prior value / failed retest of broken IB edge';
  }
  return 'e.g. Retest behavior flips — acceptance through your edge when you expected rejection, or rejection when you expected continuation';
}

export function dayTypeLabel(dayType: DayType): string {
  const option = DAY_TYPE_OPTIONS.find((item) => item.value === dayType);
  return option?.label ?? dayType;
}

export function formatLocationLabels(locations: AuctionLocation[]): string {
  if (locations.length === 0) {
    return '';
  }

  return locations
    .map((location) => LOCATION_PILLAR_OPTIONS.find((option) => option.value === location)?.label ?? location)
    .join(' · ');
}

export function filterOptions<T extends string>(
  all: SelectOption<T>[],
  allowed: readonly T[],
): SelectOption<T>[] {
  const allowedSet = new Set<string>(allowed);
  return all.filter((option) => allowedSet.has(option.value));
}

export function getPlaybookLocationOptions(playbook: AuctionPlaybook): SelectOption<AuctionLocation>[] {
  return filterOptions(AUCTION_LOCATION_OPTIONS, playbookLocations(playbook));
}

export function getPlaybookBehaviorOptions(playbook: AuctionPlaybook): SelectOption<MarketBehavior>[] {
  return filterOptions(MARKET_BEHAVIOR_OPTIONS, playbookBehaviors(playbook));
}

export function getPlaybookConfirmationOptions(
  playbook: AuctionPlaybook,
): SelectOption<ConfirmationTrigger>[] {
  return filterOptions(CONFIRMATION_TRIGGER_OPTIONS, playbookConfirmations(playbook));
}
