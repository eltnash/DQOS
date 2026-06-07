import type {
  AnalyzedTimeframe,
  CompositeValuePosition,
  HtfAnalysisTool,
  HtfAuctionRegime,
  HtfContextSnapshot,
  MarketStructureBias,
  PriorWeekRangePosition,
  WeeklyRangeContext,
} from '../../core/models/database.types';
import type { ContextStepValue, GatekeeperFormValue } from './gatekeeper-form.types';

export function serializeCheckboxGroup<T extends string>(
  group: Record<string, boolean>,
  keys: readonly T[],
): T[] {
  return keys.filter((key) => group[key] === true);
}

const PRIOR_WEEK_LABELS: Record<PriorWeekRangePosition, string> = {
  Inside_Prior_Week: 'Inside prior week',
  Breaking_Prior_Week_High: 'Above PW high',
  Breaking_Prior_Week_Low: 'Below PW low',
};

function buildWeeklyRange(context: ContextStepValue): WeeklyRangeContext | null {
  if (!context.analyzed_timeframes.W) {
    return null;
  }

  const position = context.prior_week_range_position;
  if (!position) {
    return null;
  }

  return { current_week_position: position };
}

export function mapContextStepToSnapshot(context: ContextStepValue): HtfContextSnapshot {
  const composite = context.composite_value_position;
  const regime = context.auction_regime;
  const structure = context.structure_bias;

  if (!composite || !regime || !structure) {
    throw new Error('Incomplete HTF context');
  }

  const analyzed_timeframes = serializeCheckboxGroup(
    context.analyzed_timeframes,
    ['M', 'W', 'D', 'H4', 'H1'] as const,
  );

  const tools_used = serializeCheckboxGroup(context.tools_used, [
    'Composite_VP',
    'Multi_Day_VAH_VAL_POC',
    'Major_HVN_LVN',
    'Multi_Day_TPO',
    'Value_Area_Migration',
    'Day_Type_Series',
    'Unfinished_Business',
  ] as const);

  if (analyzed_timeframes.length === 0 || tools_used.length === 0) {
    throw new Error('Select at least one timeframe and one analysis tool');
  }

  const weekly_range = buildWeeklyRange(context);
  if (context.analyzed_timeframes.W && !weekly_range) {
    throw new Error('Select where the current week is trading vs the prior week range');
  }

  return {
    analyzed_timeframes,
    trading_timeframe: context.trading_timeframe,
    composite_value_position: composite,
    auction_regime: regime,
    structure_bias: structure,
    tools_used,
    htf_thesis: context.htf_thesis.trim(),
    session_posture: context.session_posture.trim(),
    weekly_range,
  };
}

export function mapFormToHtfContext(form: GatekeeperFormValue): HtfContextSnapshot {
  return mapContextStepToSnapshot(form.context);
}

export function formatHtfContextSummary(snapshot: HtfContextSnapshot): string {
  const parts = [
    snapshot.structure_bias.replace(/_/g, ' '),
    snapshot.composite_value_position.replace(/_/g, ' '),
  ];

  if (snapshot.weekly_range) {
    parts.push(PRIOR_WEEK_LABELS[snapshot.weekly_range.current_week_position]);
  }

  return parts.join(' · ');
}

export const EXECUTION_TIMEFRAME = 'M15' as const;
