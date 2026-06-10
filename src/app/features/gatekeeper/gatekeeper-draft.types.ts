import type {
  AnalyzedTimeframe,
  AssetSymbol,
  PillarStepKey,
  TimeframeScreenshotRef,
  TradeSessionContext,
} from '../../core/models/database.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import type { ExecutionFormValue } from './execution-block.types';
import type { GatekeeperStepProgress } from './gatekeeper-step-progress.utils';

export type GatekeeperDraftSaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export interface GatekeeperDraftUiState {
  active_step: number;
  active_timeframe_tab: AnalyzedTimeframe;
}

export interface GatekeeperDraftMedia {
  htf: Partial<Record<AnalyzedTimeframe, TimeframeScreenshotRef[]>>;
  pillars: Partial<Record<PillarStepKey, TimeframeScreenshotRef[]>>;
}

export interface GatekeeperDraftRow {
  id: string;
  user_id: string;
  journal_name: string;
  trading_date: string;
  symbol: string;
  session_context: TradeSessionContext;
  wizard_form: GatekeeperFormValue;
  media: GatekeeperDraftMedia;
  ui_state: GatekeeperDraftUiState;
  execution_form?: ExecutionFormValue | Record<string, unknown>;
  updated_at: string;
}

export interface GatekeeperDraftLoadResult {
  draftId: string;
  restored: boolean;
  journalName: string;
  tradingDate: string;
  symbol: AssetSymbol;
  sessionContext: TradeSessionContext;
  wizardForm: GatekeeperFormValue;
  media: GatekeeperDraftMedia;
  uiState: GatekeeperDraftUiState;
  executionForm: ExecutionFormValue;
}

export interface GatekeeperJournalSummary {
  id: string;
  journal_name: string;
  trading_date: string;
  symbol: AssetSymbol;
  market_session: string;
  analysis_period: string;
  active_step: number;
  step_progress: GatekeeperStepProgress;
  updated_at: string;
  archived_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
}

export interface ListJournalsOptions {
  /** When true, return only archived journals; otherwise active journals only. */
  archivedOnly?: boolean;
}

export const JOURNAL_NAME_MIN_LENGTH = 3;
export const JOURNAL_NAME_MAX_LENGTH = 80;

export function normalizeJournalName(name: string): string {
  return name.trim();
}

export function validateJournalName(name: string): string | null {
  const trimmed = normalizeJournalName(name);
  if (trimmed.length < JOURNAL_NAME_MIN_LENGTH) {
    return `Journal name must be at least ${JOURNAL_NAME_MIN_LENGTH} characters.`;
  }
  if (trimmed.length > JOURNAL_NAME_MAX_LENGTH) {
    return `Journal name must be at most ${JOURNAL_NAME_MAX_LENGTH} characters.`;
  }
  if (!/\S/.test(trimmed)) {
    return 'Journal name cannot be blank.';
  }
  return null;
}

export const EMPTY_DRAFT_MEDIA: GatekeeperDraftMedia = { htf: {}, pillars: {} };

export const DEFAULT_DRAFT_UI_STATE: GatekeeperDraftUiState = {
  active_step: 1,
  active_timeframe_tab: 'W',
};

export const GATEKEEPER_STEP_LABELS = [
  'HTF Context',
  'Auction Type',
  'Location',
  'Behavior',
  'Confirmation',
  'Invalidation',
  'Execution',
  'Outcome',
] as const;
