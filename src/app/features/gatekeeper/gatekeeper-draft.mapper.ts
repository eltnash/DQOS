import type {
  AnalyzedTimeframe,
  AssetSymbol,
  AuctionLocation,
  HtfContextSnapshot,
  PillarJournalsSnapshot,
  PillarStepKey,
  TimeframeScreenshotRef,
} from '../../core/models/database.types';
import { ANALYZED_TIMEFRAME_KEYS, HTF_ANALYSIS_TOOL_OPTIONS } from '../../core/supabase/enum-options';
import { EMPTY_TAGGED_NOTES } from '../../shared/components/tagged-notes-editor/tagged-notes.utils';
import { isPlatformOrderType } from './execution-order.utils';
import type { ExecutionFormValue } from './execution-block.types';
import type { GatekeeperFormValue, HtfNarrativeFormValue, LocationStepValue } from './gatekeeper-form.types';
import type { GatekeeperDraftMedia } from './gatekeeper-draft.types';
import { mapFormToHtfContext } from './htf-context.utils';
import { mapFormToPillarJournals } from './pillar-context.utils';

function defaultToolsUsed(): Record<string, boolean> {
  return HTF_ANALYSIS_TOOL_OPTIONS.reduce(
    (acc, tool) => {
      acc[tool.key] = false;
      return acc;
    },
    {} as Record<string, boolean>,
  ) as HtfNarrativeFormValue['tools_used'];
}

function defaultNarrative(): HtfNarrativeFormValue {
  return {
    value_migration: '',
    composite_va_position: null,
    auction_regime: null,
    prior_week_range_position: null,
    tools_used: defaultToolsUsed(),
    htf_trade_posture: '',
    session_read: '',
  };
}

function defaultTimeframeJournals(): GatekeeperFormValue['context']['timeframe_journals'] {
  return ANALYZED_TIMEFRAME_KEYS.reduce(
    (acc, tf) => {
      acc[tf] = {
        notes_content: { ...EMPTY_TAGGED_NOTES },
        narrative: defaultNarrative(),
      };
      return acc;
    },
    {} as GatekeeperFormValue['context']['timeframe_journals'],
  );
}

function normalizeLocationSelections(
  location: Partial<LocationStepValue> | undefined,
): AuctionLocation[] {
  if (Array.isArray(location?.locations)) {
    return location.locations;
  }

  const legacy = (location as { location?: AuctionLocation | null } | undefined)?.location;
  return legacy ? [legacy] : [];
}

export function defaultGatekeeperFormValue(): GatekeeperFormValue {
  return {
    context: {
      analyzed_timeframes: { M: false, W: false, D: false, H4: false, H1: false },
      trading_timeframe: 'M15',
      timeframe_journals: defaultTimeframeJournals(),
    },
    auction_type: { day_type: null },
    is_retest: false,
    location: {
      focus_timeframe: 'M15',
      notes_content: { ...EMPTY_TAGGED_NOTES },
      locations: [],
    },
    behavior: {
      focus_timeframe: 'M15',
      notes_content: { ...EMPTY_TAGGED_NOTES },
      behavior: null,
    },
    confirmation: {
      focus_timeframe: 'M15',
      notes_content: { ...EMPTY_TAGGED_NOTES },
      confirmation: null,
    },
    invalidation: {
      focus_timeframe: 'M15',
      notes_content: { ...EMPTY_TAGGED_NOTES },
      invalidation_level: '',
      invalidation_price: null,
    },
  };
}

export function normalizeGatekeeperFormValue(raw: unknown): GatekeeperFormValue {
  const defaults = defaultGatekeeperFormValue();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const value = raw as Partial<GatekeeperFormValue>;
  return {
    context: {
      ...defaults.context,
      ...value.context,
      analyzed_timeframes: {
        ...defaults.context.analyzed_timeframes,
        ...value.context?.analyzed_timeframes,
      },
      timeframe_journals: ANALYZED_TIMEFRAME_KEYS.reduce(
        (acc, tf) => {
          const journal = value.context?.timeframe_journals?.[tf];
          acc[tf] = {
            notes_content: journal?.notes_content ?? { ...EMPTY_TAGGED_NOTES },
            narrative: {
              ...defaultNarrative(),
              ...journal?.narrative,
              tools_used: {
                ...defaultToolsUsed(),
                ...journal?.narrative?.tools_used,
              } as HtfNarrativeFormValue['tools_used'],
            },
          };
          return acc;
        },
        {} as GatekeeperFormValue['context']['timeframe_journals'],
      ),
    },
    auction_type: { ...defaults.auction_type, ...value.auction_type },
    is_retest: value.is_retest ?? defaults.is_retest,
    location: {
      ...defaults.location,
      ...value.location,
      locations: normalizeLocationSelections(value.location),
    },
    behavior: { ...defaults.behavior, ...value.behavior },
    confirmation: { ...defaults.confirmation, ...value.confirmation },
    invalidation: { ...defaults.invalidation, ...value.invalidation },
  };
}

export function normalizeDraftMedia(raw: unknown): GatekeeperDraftMedia {
  if (!raw || typeof raw !== 'object') {
    return { htf: {}, pillars: {} };
  }

  const value = raw as Partial<GatekeeperDraftMedia>;
  return {
    htf: value.htf ?? {},
    pillars: value.pillars ?? {},
  };
}

function attachHtfScreenshots(
  context: HtfContextSnapshot,
  media: GatekeeperDraftMedia,
): HtfContextSnapshot {
  return {
    ...context,
    timeframe_entries: context.timeframe_entries.map((entry) => ({
      ...entry,
      screenshots: media.htf[entry.timeframe] ?? entry.screenshots,
    })),
  };
}

function attachPillarScreenshots(
  journals: PillarJournalsSnapshot,
  media: GatekeeperDraftMedia,
): PillarJournalsSnapshot {
  const steps: PillarStepKey[] = ['location', 'behavior', 'confirmation', 'invalidation'];
  const result = { ...journals };

  for (const step of steps) {
    result[step] = {
      ...journals[step],
      screenshots: media.pillars[step] ?? journals[step].screenshots,
    };
  }

  return result;
}

export function mergeDraftMediaIntoAudit(
  form: GatekeeperFormValue,
  media: GatekeeperDraftMedia,
): { htf_context: HtfContextSnapshot; pillar_journals: PillarJournalsSnapshot } {
  return {
    htf_context: attachHtfScreenshots(mapFormToHtfContext(form), media),
    pillar_journals: attachPillarScreenshots(mapFormToPillarJournals(form), media),
  };
}

export function screenshotRefsForScope(
  media: GatekeeperDraftMedia,
  scope: { kind: 'htf'; id: AnalyzedTimeframe } | { kind: 'pillar'; id: PillarStepKey },
): TimeframeScreenshotRef[] {
  if (scope.kind === 'htf') {
    return media.htf[scope.id] ?? [];
  }
  return media.pillars[scope.id] ?? [];
}

export function defaultExecutionFormValue(symbol: AssetSymbol = 'EURUSD'): ExecutionFormValue {
  return {
    ticket: null,
    symbol,
    order_type: 'Market_Execution',
    direction: 'LONG',
    volume: null,
    entry_time: null,
    entry_price: null,
    stop_price: null,
    take_profit_price: null,
    exit_time: null,
    exit_price: null,
    commission: null,
    fee: null,
    swap: null,
    profit: null,
    comment: null,
  };
}

export function normalizeExecutionFormValue(raw: unknown, symbol: AssetSymbol = 'EURUSD'): ExecutionFormValue {
  const defaults = defaultExecutionFormValue(symbol);
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const value = raw as Record<string, unknown>;
  const legacySize = value['size'];
  const legacyTarget = value['target_price'];
  const legacyNotes = value['notes'];

  return {
    ticket: typeof value['ticket'] === 'string' ? value['ticket'] : null,
    symbol: (typeof value['symbol'] === 'string' ? value['symbol'] : symbol) as AssetSymbol,
    order_type: isPlatformOrderType(value['order_type'])
      ? value['order_type']
      : 'Market_Execution',
    direction: value['direction'] === 'SHORT' ? 'SHORT' : 'LONG',
    volume:
      typeof value['volume'] === 'number'
        ? value['volume']
        : typeof legacySize === 'number'
          ? legacySize
          : null,
    entry_time: typeof value['entry_time'] === 'string' ? value['entry_time'] : null,
    entry_price: typeof value['entry_price'] === 'number' ? value['entry_price'] : null,
    stop_price: typeof value['stop_price'] === 'number' ? value['stop_price'] : null,
    take_profit_price:
      typeof value['take_profit_price'] === 'number'
        ? value['take_profit_price']
        : typeof legacyTarget === 'number'
          ? legacyTarget
          : null,
    exit_time: typeof value['exit_time'] === 'string' ? value['exit_time'] : null,
    exit_price: typeof value['exit_price'] === 'number' ? value['exit_price'] : null,
    commission: typeof value['commission'] === 'number' ? value['commission'] : null,
    fee: typeof value['fee'] === 'number' ? value['fee'] : null,
    swap: typeof value['swap'] === 'number' ? value['swap'] : null,
    profit: typeof value['profit'] === 'number' ? value['profit'] : null,
    comment:
      typeof value['comment'] === 'string'
        ? value['comment']
        : typeof legacyNotes === 'string'
          ? legacyNotes
          : null,
  };
}
