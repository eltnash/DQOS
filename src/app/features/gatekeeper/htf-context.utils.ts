import type {
  AnalyzedTimeframe,
  HtfContextSnapshot,
  HtfNarrativeSnapshot,
} from '../../core/models/database.types';
import type { ContextStepValue, GatekeeperFormValue } from './gatekeeper-form.types';

const TIMEFRAME_LABELS: Record<AnalyzedTimeframe, string> = {
  M: 'Monthly',
  W: 'Weekly',
  D: 'Daily',
  H4: '4H',
  H1: '1H',
};

function emptyNarrativeSnapshot(): HtfNarrativeSnapshot {
  return {
    value_migration: '',
    tools_used: [],
    htf_trade_posture: '',
  };
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
      narrative: emptyNarrativeSnapshot(),
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
