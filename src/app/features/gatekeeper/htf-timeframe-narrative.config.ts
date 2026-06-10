import type { AnalyzedTimeframe, CompositeValuePosition, HtfAnalysisTool } from '../../core/models/database.types';
import type { SelectOption } from '../../core/supabase/enum-options';
import { DEVELOPING_VALUE_POSITION_OPTIONS } from '../../core/supabase/enum-options';
import type { HtfNarrativeBlock } from './htf-narrative.content';

export type TimeframeNarrativeFieldKey =
  | 'value_migration'
  | 'composite_va_position'
  | 'auction_regime'
  | 'prior_week_range_position'
  | 'tools_used'
  | 'htf_trade_posture'
  | 'session_read';

export type TimeframeNarrativeFieldType =
  | 'textarea'
  | 'composite_va'
  | 'auction_regime'
  | 'prior_week_range'
  | 'tools';

export interface TimeframeNarrativeFieldConfig {
  key: TimeframeNarrativeFieldKey;
  type: TimeframeNarrativeFieldType;
  label: string;
  prompt?: string;
  placeholder?: string;
  /** Overrides default composite VA pill labels when the read is not composite-based. */
  compositeVaOptions?: SelectOption<CompositeValuePosition>[];
}

export interface TimeframeToolDisplay {
  key: HtfAnalysisTool;
  label: string;
  hint?: string;
}

export interface TimeframeNarrativeConfig {
  intro: HtfNarrativeBlock;
  bridge?: HtfNarrativeBlock;
  toolsReference?: HtfNarrativeBlock;
  fields: readonly TimeframeNarrativeFieldConfig[];
  toolKeys: readonly HtfAnalysisTool[];
  /** Display labels scoped to this timeframe (storage keys unchanged). */
  toolLabels: Partial<Record<HtfAnalysisTool, Pick<TimeframeToolDisplay, 'label' | 'hint'>>>;
}

const WEEKLY_NARRATIVE: TimeframeNarrativeConfig = {
  intro: {
    heading: 'Weekly context — prior week range & composite',
    paragraphs: [
      'Weekly HTF covers a 1–2 week lookback only — prior week high/low and prior week composite relative to the developing week. Nothing broader than what affects intraday trades.',
    ],
  },
  toolsReference: {
    heading: 'Weekly tools to reference (1–2 week window)',
    paragraphs: [
      'Prior week high/low lines · Prior week composite VAH / VAL / POC · 1–2 week composite profile · Key HVNs & LVNs · Market structure trend lines.',
    ],
  },
  fields: [
    {
      key: 'value_migration',
      type: 'textarea',
      label: 'Prior week high and low — what are the exact levels?',
      prompt: 'Mark acceptance or rejection at each level and why it still matters for this week.',
      placeholder:
        'Prior week high, prior week low, and how price has interacted with each so far this week…',
    },
    {
      key: 'prior_week_range_position',
      type: 'prior_week_range',
      label: 'Where is the developing week trading vs prior week range?',
      prompt: 'Inside prior week · Above prior week high · Below prior week low',
    },
    {
      key: 'composite_va_position',
      type: 'composite_va',
      label: 'Prior week composite vs the developing week',
      prompt: 'Above · Below · Inside prior week composite value area',
    },
    {
      key: 'auction_regime',
      type: 'auction_regime',
      label: 'What is the weekly auction doing?',
      prompt:
        'Breaking balance · Rotating in balance · Repairing structure · Migrating to composite POC',
    },
    { key: 'tools_used', type: 'tools', label: 'Which tools did you use for this weekly read?' },
    {
      key: 'htf_trade_posture',
      type: 'textarea',
      label: 'What intraday trades might this weekly read support?',
      prompt: 'Fade prior week extremes, join migration toward composite POC, or stand aside?',
      placeholder: 'You do not take the trade here — define the environment intraday setups must fit…',
    },
  ],
  toolKeys: [
    'Composite_VP',
    'Multi_Day_VAH_VAL_POC',
    'Major_HVN_LVN',
    'Market_Structure_Trendlines',
    'Prior_Week_HL_Lines',
  ],
  toolLabels: {
    Composite_VP: {
      label: '1–2 week composite volume profile',
      hint: 'Composite profile built from the last 1–2 weeks — not monthly macro',
    },
    Multi_Day_VAH_VAL_POC: {
      label: 'Prior week & 1–2 week VAH / VAL / POC',
      hint: 'Prior week composite plus recent week value — the only VAH/VAL/POC window that matters here',
    },
    Major_HVN_LVN: {
      label: 'Key HVNs & LVNs (1–2 week window)',
      hint: 'High/low volume nodes within the last 1–2 weeks',
    },
  },
};

const MONTHLY_NARRATIVE: TimeframeNarrativeConfig = {
  intro: {
    heading: 'Monthly context — macro value migration',
    paragraphs: [
      'Where has value migrated over the last several weeks? Are we breaking balance, rotating inside it, or repairing old structure?',
    ],
  },
  toolsReference: {
    heading: 'Monthly tools to reference',
    paragraphs: [
      'Composite volume profile · Multi-day VAH / VAL / POC · Major HVNs & LVNs · Value area migration · Day type series · Unfinished business.',
    ],
  },
  fields: [
    {
      key: 'value_migration',
      type: 'textarea',
      label: 'Where has macro value been over recent weeks?',
      placeholder: 'Composite profile shape, major balance boundaries, and value migration…',
    },
    {
      key: 'composite_va_position',
      type: 'composite_va',
      label: 'Are we trading relative to composite value?',
      prompt: 'Above · Below · Inside composite volume profile value area',
    },
    {
      key: 'auction_regime',
      type: 'auction_regime',
      label: 'What is the macro auction doing?',
      prompt: 'Breaking balance · Rotating in balance · Repairing structure · Migrating to composite POC',
    },
    { key: 'tools_used', type: 'tools', label: 'Which tools did you use for this monthly read?' },
    {
      key: 'htf_trade_posture',
      type: 'textarea',
      label: 'What kind of trades might make sense later?',
      placeholder: 'Push toward new value, fade extremes in balance, or wait for migration…',
    },
  ],
  toolKeys: [
    'Composite_VP',
    'Multi_Day_VAH_VAL_POC',
    'Major_HVN_LVN',
    'Multi_Day_TPO',
    'Value_Area_Migration',
    'Day_Type_Series',
    'Unfinished_Business',
  ],
  toolLabels: {
    Composite_VP: { label: 'Monthly composite volume profile' },
    Multi_Day_VAH_VAL_POC: { label: 'Multi-week VAH / VAL / POC' },
    Multi_Day_TPO: { label: 'Multi-week TPO / value migration' },
    Value_Area_Migration: { label: 'Macro value area migration' },
    Day_Type_Series: { label: 'Multi-week day type character' },
  },
};

const DAILY_NARRATIVE: TimeframeNarrativeConfig = {
  intro: {
    paragraphs: [],
  },
  toolsReference: {
    heading: 'Daily tools to reference',
    paragraphs: [
      'Session / developing profile · Prior day high/low · Prior day composite · Day type · VWAP references.',
    ],
  },
  fields: [
    {
      key: 'value_migration',
      type: 'textarea',
      label: 'Developing day value and prior day references',
      placeholder: 'Prior day VAH/VAL/POC, overnight structure, and developing day type…',
    },
    {
      key: 'composite_va_position',
      type: 'composite_va',
      label: 'Price relative to prior day / developing value',
      prompt: 'Above · Below · Inside value area',
      compositeVaOptions: DEVELOPING_VALUE_POSITION_OPTIONS,
    },
    {
      key: 'auction_regime',
      type: 'auction_regime',
      label: 'What is the daily auction doing?',
      prompt: 'Breaking balance · Rotating in balance · Repairing structure · Migrating to composite POC',
    },
    { key: 'tools_used', type: 'tools', label: 'Which tools did you use for this daily read?' },
    {
      key: 'htf_trade_posture',
      type: 'textarea',
      label: 'What intraday posture does today support?',
      placeholder: 'Mean reversion at edges, trend continuation, or wait for clarity…',
    },
    {
      key: 'session_read',
      type: 'textarea',
      label: 'How is the live session translating this daily read?',
      placeholder: 'Acceptance vs rejection at key levels so far today…',
    },
  ],
  toolKeys: [
    'Composite_VP',
    'Multi_Day_VAH_VAL_POC',
    'Major_HVN_LVN',
    'Day_Type_Series',
    'Market_Structure_Trendlines',
    'Prior_Week_HL_Lines',
  ],
  toolLabels: {
    Composite_VP: { label: 'Developing session / daily profile' },
    Multi_Day_VAH_VAL_POC: { label: 'Prior day VAH / VAL / POC' },
    Day_Type_Series: { label: 'Developing day type' },
    Prior_Week_HL_Lines: { label: 'Prior day high / low lines' },
  },
};

const H4_NARRATIVE: TimeframeNarrativeConfig = {
  intro: {
    heading: '4 Hour context — intermediate structure',
    paragraphs: [
      'Bridge macro HTF with intraday execution. Map rotations, breaks, and value migration on the 4H chart.',
    ],
  },
  fields: [
    {
      key: 'value_migration',
      type: 'textarea',
      label: '4H structure and value migration',
      placeholder: 'Swings, value areas, and how 4H structure feeds 15m execution…',
    },
    {
      key: 'composite_va_position',
      type: 'composite_va',
      label: '4H price relative to value',
      prompt: 'Above · Below · Inside value area',
    },
    {
      key: 'auction_regime',
      type: 'auction_regime',
      label: '4H auction character',
      prompt: 'Breaking balance · Rotating in balance · Repairing structure · Migrating to composite POC',
    },
    { key: 'tools_used', type: 'tools', label: 'Which tools did you use on the 4H read?' },
    {
      key: 'htf_trade_posture',
      type: 'textarea',
      label: 'What 15m trades does this 4H read support?',
      placeholder: 'Pullback zones, rotation fades, or breakout continuation…',
    },
  ],
  toolKeys: [
    'Composite_VP',
    'Multi_Day_VAH_VAL_POC',
    'Major_HVN_LVN',
    'Market_Structure_Trendlines',
    'Value_Area_Migration',
  ],
  toolLabels: {
    Composite_VP: { label: '4H session composite profile' },
    Multi_Day_VAH_VAL_POC: { label: 'Multi-session VAH / VAL / POC' },
    Value_Area_Migration: { label: 'Intraweek value migration' },
  },
};

const H1_NARRATIVE: TimeframeNarrativeConfig = {
  intro: {
    heading: '1 Hour context — intraday structure into 15m',
    paragraphs: [
      'Read how the last few hours are organizing before dropping to 15m execution. Focus on swings and session value.',
    ],
  },
  fields: [
    {
      key: 'value_migration',
      type: 'textarea',
      label: '1H intraday structure',
      placeholder: 'Recent swings, session POC/VWAP, and structure into 15m…',
    },
    {
      key: 'composite_va_position',
      type: 'composite_va',
      label: '1H price relative to session / intraday value',
      prompt: 'Above · Below · Inside value area',
    },
    {
      key: 'auction_regime',
      type: 'auction_regime',
      label: '1H auction character',
      prompt: 'Breaking balance · Rotating in balance · Repairing structure · Migrating to composite POC',
    },
    { key: 'tools_used', type: 'tools', label: 'Which tools did you use on the 1H read?' },
    {
      key: 'htf_trade_posture',
      type: 'textarea',
      label: 'What 15m execution posture does 1H support?',
      placeholder: 'Retest zones, confirmation context, or stand aside…',
    },
  ],
  toolKeys: [
    'Composite_VP',
    'Major_HVN_LVN',
    'Market_Structure_Trendlines',
    'Day_Type_Series',
  ],
  toolLabels: {
    Composite_VP: { label: 'Session volume profile' },
    Major_HVN_LVN: { label: 'Session HVNs & LVNs' },
    Day_Type_Series: { label: 'Intraday day type character' },
  },
};

export const TIMEFRAME_NARRATIVE_CONFIG: Record<AnalyzedTimeframe, TimeframeNarrativeConfig> = {
  M: MONTHLY_NARRATIVE,
  W: WEEKLY_NARRATIVE,
  D: DAILY_NARRATIVE,
  H4: H4_NARRATIVE,
  H1: H1_NARRATIVE,
};

export function timeframeNarrativeConfig(tf: AnalyzedTimeframe): TimeframeNarrativeConfig {
  return TIMEFRAME_NARRATIVE_CONFIG[tf];
}

export function narrativeFieldKeysForTimeframe(tf: AnalyzedTimeframe): TimeframeNarrativeFieldKey[] {
  return TIMEFRAME_NARRATIVE_CONFIG[tf].fields.map((field) => field.key);
}

/** Daily HTF journal is chart + notes only — no narrative Q&A. */
export function htfContextNarrativeFieldKeys(tf: AnalyzedTimeframe): TimeframeNarrativeFieldKey[] {
  if (tf === 'D') {
    return [];
  }
  return narrativeFieldKeysForTimeframe(tf);
}
