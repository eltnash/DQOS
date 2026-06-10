import type {
  AnalyzedTimeframe,
  HtfContextSnapshot,
  HtfNarrativeSnapshot,
} from '../../core/models/database.types';
import { HTF_ANALYSIS_TOOL_OPTIONS } from '../../core/supabase/enum-options';
import type { ContextStepValue, GatekeeperFormValue, HtfNarrativeFormValue } from './gatekeeper-form.types';
import { htfContextNarrativeFieldKeys } from './htf-timeframe-narrative.config';

const TIMEFRAME_LABELS: Record<AnalyzedTimeframe, string> = {
  M: 'Monthly',
  W: 'Weekly',
  D: 'Daily',
  H4: '4H',
  H1: '1H',
};

function mapNarrativeToSnapshot(
  narrative: HtfNarrativeFormValue,
  tf: AnalyzedTimeframe,
): HtfNarrativeSnapshot {
  const fieldKeys = htfContextNarrativeFieldKeys(tf);

  if (fieldKeys.length === 0) {
    return {
      value_migration: '',
      tools_used: [],
      htf_trade_posture: '',
    };
  }

  if (fieldKeys.includes('composite_va_position') && !narrative.composite_va_position) {
    throw new Error(`Complete the ${TIMEFRAME_LABELS[tf]} narrative Q&A`);
  }
  if (fieldKeys.includes('auction_regime') && !narrative.auction_regime) {
    throw new Error(`Complete the ${TIMEFRAME_LABELS[tf]} narrative Q&A`);
  }
  if (fieldKeys.includes('prior_week_range_position') && !narrative.prior_week_range_position) {
    throw new Error(`Complete the ${TIMEFRAME_LABELS[tf]} narrative Q&A`);
  }

  const tools_used = HTF_ANALYSIS_TOOL_OPTIONS.filter(
    (tool) => narrative.tools_used[tool.key],
  ).map((tool) => tool.key);

  const snapshot: HtfNarrativeSnapshot = {
    value_migration: narrative.value_migration.trim(),
    composite_va_position: narrative.composite_va_position!,
    auction_regime: narrative.auction_regime!,
    tools_used,
    htf_trade_posture: narrative.htf_trade_posture.trim(),
  };

  if (fieldKeys.includes('prior_week_range_position') && narrative.prior_week_range_position) {
    snapshot.prior_week_range_position = narrative.prior_week_range_position;
  }

  if (fieldKeys.includes('session_read')) {
    snapshot.session_read = narrative.session_read.trim();
  }

  return snapshot;
}

export function mapContextStepToSnapshot(context: ContextStepValue): HtfContextSnapshot {
  const selected = (Object.keys(context.analyzed_timeframes) as AnalyzedTimeframe[]).filter(
    (tf) => context.analyzed_timeframes[tf],
  );

  const timeframe_entries = selected.map((tf) => {
    const journal = context.timeframe_journals[tf];
    return {
      timeframe: tf,
      notes: journal.notes_content.text.trim(),
      note_tags: journal.notes_content.tags,
      screenshots: [],
      narrative: mapNarrativeToSnapshot(journal.narrative, tf),
    };
  });

  if (timeframe_entries.length === 0) {
    throw new Error('Select at least one timeframe');
  }

  return {
    trading_timeframe: context.trading_timeframe,
    timeframe_entries,
  };
}

export function mapFormToHtfContext(form: GatekeeperFormValue): HtfContextSnapshot {
  return mapContextStepToSnapshot(form.context);
}

export function formatHtfContextSummary(snapshot: HtfContextSnapshot): string {
  return snapshot.timeframe_entries
    .map((entry) => `${TIMEFRAME_LABELS[entry.timeframe]} journaled`)
    .join(' · ');
}

export function timeframeLabel(tf: AnalyzedTimeframe): string {
  return TIMEFRAME_LABELS[tf];
}

export const EXECUTION_TIMEFRAME = 'M15' as const;
