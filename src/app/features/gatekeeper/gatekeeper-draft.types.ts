import type {
  AnalyzedTimeframe,
  AssetSymbol,
  PillarStepKey,
  TimeframeScreenshotRef,
  TradeSessionContext,
} from '../../core/models/database.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';

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
}

export interface GatekeeperJournalSummary {
  id: string;
  journal_name: string;
  trading_date: string;
  symbol: AssetSymbol;
  market_session: string;
  analysis_period: string;
  active_step: number;
  updated_at: string;
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
] as const;
