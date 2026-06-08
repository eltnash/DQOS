import type {
  AnalyzedTimeframe,
  HtfContextSnapshot,
  PillarJournalsSnapshot,
  PillarStepKey,
  TimeframeScreenshotRef,
} from '../../core/models/database.types';
import { ANALYZED_TIMEFRAME_KEYS, HTF_ANALYSIS_TOOL_OPTIONS } from '../../core/supabase/enum-options';
import { EMPTY_TAGGED_NOTES } from '../../shared/components/tagged-notes-editor/tagged-notes.utils';
import type { GatekeeperFormValue, HtfNarrativeFormValue } from './gatekeeper-form.types';
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
      location: null,
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
    location: { ...defaults.location, ...value.location },
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
