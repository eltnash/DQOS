import type {
  AnalyzedTimeframe,
  HtfAnalysisTool,
  HtfContextSnapshot,
  HtfNarrativeSnapshot,
} from '../../core/models/database.types';
import { ANALYZED_TIMEFRAME_KEYS, HTF_ANALYSIS_TOOL_OPTIONS } from '../../core/supabase/enum-options';
import type { ContextStepValue, GatekeeperFormValue } from './gatekeeper-form.types';

const TIMEFRAME_LABELS: Record<AnalyzedTimeframe, string> = {
  M: 'Monthly',
  W: 'Weekly',
  D: 'Daily',
  H4: '4H',
  H1: '1H',
};

const COMPOSITE_VA_LABELS: Record<HtfNarrativeSnapshot['composite_va_position'], string> = {
  Above_VA: 'Above composite VA',
  Below_VA: 'Below composite VA',
  Inside_VA: 'Inside composite VA',
};

function mapNarrativeToSnapshot(context: ContextStepValue): HtfNarrativeSnapshot {
  const narrative = context.narrative;
  if (!narrative.composite_va_position || !narrative.auction_regime) {
    throw new Error('Complete the HTF narrative Q&A');
  }

  const tools_used = HTF_ANALYSIS_TOOL_OPTIONS.filter(
    (tool) => narrative.tools_used[tool.key],
  ).map((tool) => tool.key);

  return {
    value_migration: narrative.value_migration.trim(),
    composite_va_position: narrative.composite_va_position,
    auction_regime: narrative.auction_regime,
    tools_used,
    htf_trade_posture: narrative.htf_trade_posture.trim(),
    session_read: narrative.session_read.trim(),
  };
}

export function mapContextStepToSnapshot(context: ContextStepValue): HtfContextSnapshot {
  const timeframe_entries = ANALYZED_TIMEFRAME_KEYS.filter(
    (tf) => context.analyzed_timeframes[tf],
  ).map((tf) => {
    const journal = context.timeframe_journals[tf];
    return {
      timeframe: tf,
      notes: journal.notes_content.text.trim(),
      note_tags: journal.notes_content.tags,
      screenshots: [],
    };
  });

  if (timeframe_entries.length === 0) {
    throw new Error('Select at least one timeframe');
  }

  return {
    trading_timeframe: context.trading_timeframe,
    narrative: mapNarrativeToSnapshot(context),
    timeframe_entries,
  };
}

export function mapFormToHtfContext(form: GatekeeperFormValue): HtfContextSnapshot {
  return mapContextStepToSnapshot(form.context);
}

export function formatHtfContextSummary(snapshot: HtfContextSnapshot): string {
  const vaLabel = COMPOSITE_VA_LABELS[snapshot.narrative.composite_va_position];
  const tfSummary = snapshot.timeframe_entries
    .map((entry) => `${TIMEFRAME_LABELS[entry.timeframe]} journaled`)
    .join(' · ');

  return `${vaLabel} · ${tfSummary}`;
}

export function timeframeLabel(tf: AnalyzedTimeframe): string {
  return TIMEFRAME_LABELS[tf];
}

export const EXECUTION_TIMEFRAME = 'M15' as const;
