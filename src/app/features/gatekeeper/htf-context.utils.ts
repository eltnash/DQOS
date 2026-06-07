import type { AnalyzedTimeframe, HtfContextSnapshot } from '../../core/models/database.types';
import { ANALYZED_TIMEFRAME_KEYS } from '../../core/supabase/enum-options';
import type { ContextStepValue, GatekeeperFormValue } from './gatekeeper-form.types';

const TIMEFRAME_LABELS: Record<AnalyzedTimeframe, string> = {
  M: 'Monthly',
  W: 'Weekly',
  D: 'Daily',
  H4: '4H',
  H1: '1H',
};

export function mapContextStepToSnapshot(context: ContextStepValue): HtfContextSnapshot {
  const timeframe_entries = ANALYZED_TIMEFRAME_KEYS.filter(
    (tf) => context.analyzed_timeframes[tf],
  ).map((tf) => ({
    timeframe: tf,
    notes: context.timeframe_journals[tf].notes.trim(),
    screenshot: null,
  }));

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
