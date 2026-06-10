import { Injectable, inject, signal } from '@angular/core';
import { Subject, debounceTime } from 'rxjs';

import type {
  AnalyzedTimeframe,
  AssetSymbol,
  PillarStepKey,
  TimeframeScreenshotRef,
} from '../../core/models/database.types';
import { GatekeeperMediaService } from '../../core/supabase/gatekeeper-media.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import {
  defaultExecutionFormValue,
  defaultGatekeeperFormValue,
  mergeDraftMediaIntoAudit,
  normalizeDraftMedia,
  normalizeExecutionFormValue,
  normalizeGatekeeperFormValue,
  screenshotRefsForScope,
} from './gatekeeper-draft.mapper';
import { computeGatekeeperStepProgress } from './gatekeeper-step-progress.utils';
import type {
  GatekeeperDraftLoadResult,
  GatekeeperDraftMedia,
  GatekeeperDraftRow,
  GatekeeperDraftSaveStatus,
  GatekeeperDraftUiState,
  GatekeeperJournalSummary,
  ListJournalsOptions,
} from './gatekeeper-draft.types';
import {
  DEFAULT_DRAFT_UI_STATE,
  EMPTY_DRAFT_MEDIA,
  normalizeJournalName,
  validateJournalName,
} from './gatekeeper-draft.types';
import type { ExecutionFormValue } from './execution-block.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import type { JournalScreenshotScope } from './gatekeeper-screenshot-draft.service';
import type { TradingSessionState } from './trading-session.types';

const SAVE_DEBOUNCE_MS = 1500;

const DRAFT_SELECT =
  'id, user_id, journal_name, trading_date, symbol, session_context, wizard_form, media, ui_state, execution_form, updated_at';

interface PendingWizardSave {
  form: GatekeeperFormValue;
  uiState: GatekeeperDraftUiState;
}

@Injectable({ providedIn: 'root' })
export class GatekeeperDraftService {
  private readonly supabase = inject(SupabaseService);
  private readonly mediaService = inject(GatekeeperMediaService);

  private readonly draftId = signal<string | null>(null);
  private readonly boundSession = signal<TradingSessionState | null>(null);
  private initPromise: Promise<GatekeeperDraftLoadResult> | null = null;
  private initPromiseKey: string | null = null;
  private readonly mediaState = signal<GatekeeperDraftMedia>(EMPTY_DRAFT_MEDIA);
  private readonly saveStatus = signal<GatekeeperDraftSaveStatus>('idle');
  private readonly saveError = signal<string | null>(null);
  private lastWizardSnapshot: PendingWizardSave | null = null;
  private lastExecutionSnapshot: ExecutionFormValue | null = null;

  private readonly saveQueue = new Subject<void>();
  private saveSubscriptionStarted = false;

  readonly status = this.saveStatus.asReadonly();
  readonly error = this.saveError.asReadonly();
  readonly activeDraftId = this.draftId.asReadonly();

  constructor() {
    this.startSaveQueue();
  }

  getMedia(): GatekeeperDraftMedia {
    return this.mediaState();
  }

  bindSession(sessionState: TradingSessionState | null): void {
    this.boundSession.set(sessionState);
  }

  async initById(draftId: string): Promise<GatekeeperDraftLoadResult> {
    this.saveStatus.set('loading');
    this.saveError.set(null);

    const client = this.supabase.client;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      this.clearActive();
      throw new Error('Sign in to open saved journals.');
    }

    const { data, error } = await client
      .from('gatekeeper_drafts')
      .select(DRAFT_SELECT)
      .eq('id', draftId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error(this.formatDraftError(error.message));
    }

    if (!data) {
      throw new Error('Journal not found or you do not have access.');
    }

    const result = this.applyLoadedDraft(data as GatekeeperDraftRow, true);
    this.boundSession.set(this.sessionStateFromRow(data as GatekeeperDraftRow));
    return result;
  }

  async initForSession(sessionState: TradingSessionState): Promise<GatekeeperDraftLoadResult> {
    this.saveStatus.set('loading');
    this.saveError.set(null);

    const client = this.supabase.client;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      this.clearActive();
      this.saveStatus.set('idle');
      throw new Error('Sign in to save screenshots and drafts to the cloud.');
    }

    const journalName = sessionState.journalName.trim();
    const { data: existing, error: fetchError } = await client
      .from('gatekeeper_drafts')
      .select('id')
      .eq('user_id', user.id)
      .eq('journal_name', journalName)
      .maybeSingle();

    if (fetchError) {
      this.saveStatus.set('error');
      this.saveError.set(fetchError.message);
      throw new Error(this.formatDraftError(fetchError.message));
    }

    if (existing) {
      this.saveStatus.set('error');
      throw new Error(
        'A journal with this name already exists. Resume it from the Journal page or choose a different name.',
      );
    }

    const session = sessionState.session;
    const insertPayload = {
      user_id: user.id,
      journal_name: journalName,
      trading_date: session.trading_date,
      symbol: sessionState.symbol,
      session_context: session,
      wizard_form: defaultGatekeeperFormValue(),
      media: EMPTY_DRAFT_MEDIA,
      ui_state: DEFAULT_DRAFT_UI_STATE,
      execution_form: defaultExecutionFormValue(sessionState.symbol),
    };

    const { data: created, error: insertError } = await client
      .from('gatekeeper_drafts')
      .insert(insertPayload)
      .select(DRAFT_SELECT)
      .single();

    if (insertError || !created) {
      this.saveStatus.set('error');
      this.saveError.set(insertError?.message ?? 'Could not create draft');
      throw new Error(this.formatDraftError(insertError?.message ?? 'Could not create draft'));
    }

    return this.applyLoadedDraft(created as GatekeeperDraftRow, false);
  }

  async listJournals(options?: ListJournalsOptions): Promise<GatekeeperJournalSummary[]> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();

    if (!user) {
      return [];
    }

    let query = this.supabase.client
      .from('gatekeeper_drafts')
      .select(
        'id, journal_name, trading_date, symbol, session_context, wizard_form, media, ui_state, execution_form, updated_at, archived_at',
      )
      .eq('user_id', user.id);

    if (options?.archivedOnly) {
      query = query.not('archived_at', 'is', null);
    } else {
      query = query.is('archived_at', null);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      throw new Error(this.formatDraftError(error.message));
    }

    return (data ?? []).map((row) => {
      const context = row.session_context as TradingSessionState['session'];
      const uiState = row.ui_state as GatekeeperDraftUiState | null;
      const wizardForm = normalizeGatekeeperFormValue(row.wizard_form);
      const media = normalizeDraftMedia(row.media);
      const executionForm = normalizeExecutionFormValue(
        row.execution_form,
        row.symbol as AssetSymbol,
      );
      const activeStep = uiState?.active_step ?? 1;

      return {
        id: row.id,
        journal_name: row.journal_name,
        trading_date: row.trading_date,
        symbol: row.symbol as AssetSymbol,
        market_session: context.market_session,
        analysis_period: context.analysis_period,
        active_step: activeStep,
        step_progress: computeGatekeeperStepProgress({
          wizardForm,
          media,
          executionForm,
          symbol: row.symbol as AssetSymbol,
          activeStep,
        }),
        updated_at: row.updated_at,
        archived_at: row.archived_at ?? null,
      };
    });
  }

  async renameJournal(draftId: string, newName: string): Promise<string> {
    const trimmed = normalizeJournalName(newName);
    const validationError = validateJournalName(trimmed);
    if (validationError) {
      throw new Error(validationError);
    }

    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Sign in to rename journals.');
    }

    const { data, error } = await this.supabase.client
      .from('gatekeeper_drafts')
      .update({ journal_name: trimmed })
      .eq('id', draftId)
      .eq('user_id', user.id)
      .select('journal_name')
      .maybeSingle();

    if (error) {
      throw new Error(this.formatDraftError(error.message));
    }

    if (!data) {
      throw new Error('Journal not found or you do not have access.');
    }

    if (this.draftId() === draftId) {
      const session = this.boundSession();
      if (session) {
        this.boundSession.set({ ...session, journalName: trimmed });
      }
    }

    return data.journal_name;
  }

  async archiveJournal(draftId: string): Promise<void> {
    await this.setArchivedAt(draftId, new Date().toISOString());
  }

  async restoreJournal(draftId: string): Promise<void> {
    await this.setArchivedAt(draftId, null);
  }

  async deleteJournal(draftId: string): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Sign in to delete journals.');
    }

    await this.removeDraftWithMedia(draftId, user.id);
  }

  peekExecutionSnapshot(): ExecutionFormValue | null {
    return this.lastExecutionSnapshot;
  }

  scheduleSave(form: GatekeeperFormValue, uiState: GatekeeperDraftUiState): void {
    if (!this.draftId()) {
      return;
    }
    this.lastWizardSnapshot = { form, uiState };
    this.saveQueue.next();
  }

  scheduleExecutionSave(executionForm: ExecutionFormValue): void {
    this.lastExecutionSnapshot = executionForm;
    if (!this.draftId()) {
      return;
    }
    this.saveQueue.next();
  }

  /** Ensures a cloud draft row exists for the bound session (needed before ledger submit). */
  async ensureActiveDraft(): Promise<void> {
    await this.ensureDraftReady();
  }

  async saveNow(form: GatekeeperFormValue, uiState: GatekeeperDraftUiState): Promise<void> {
    await this.ensureDraftReady();
    this.lastWizardSnapshot = { form, uiState };
    await this.flushSave();
    if (this.saveStatus() === 'error') {
      throw new Error(this.saveError() ?? 'Save failed');
    }
  }

  async persistScreenshot(
    scope: JournalScreenshotScope,
    itemId: string,
    file: File,
    isAnnotated = false,
  ): Promise<TimeframeScreenshotRef> {
    await this.ensureDraftReady();
    const draftId = this.draftId();
    if (!draftId) {
      throw new Error('Could not start a saved Gatekeeper session. Try refreshing the page.');
    }

    const validationError = this.mediaService.validateFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const ref = await this.uploadScopedFile(user.id, draftId, scope, file, isAnnotated);
    const nextMedia = this.appendMediaRef(scope, ref);
    this.mediaState.set(nextMedia);
    await this.persistMedia(nextMedia);
    return ref;
  }

  async replacePersistedScreenshot(
    scope: JournalScreenshotScope,
    storagePath: string,
    file: File,
  ): Promise<TimeframeScreenshotRef> {
    await this.deleteStorageObject(storagePath);
    const nextMedia = this.removeMediaRef(scope, storagePath);
    this.mediaState.set(nextMedia);

    return this.persistScreenshot(scope, crypto.randomUUID(), file, true);
  }

  async removePersistedScreenshot(scope: JournalScreenshotScope, storagePath: string): Promise<void> {
    await this.deleteStorageObject(storagePath);
    const nextMedia = this.removeMediaRef(scope, storagePath);
    this.mediaState.set(nextMedia);
    await this.persistMedia(nextMedia);
  }

  async clearScopeMedia(scope: JournalScreenshotScope): Promise<void> {
    const refs = screenshotRefsForScope(this.mediaState(), scope);
    if (refs.length === 0) {
      return;
    }

    await Promise.all(refs.map((ref) => this.deleteStorageObject(ref.storage_path)));

    const nextMedia =
      scope.kind === 'htf'
        ? {
            ...this.mediaState(),
            htf: { ...this.mediaState().htf, [scope.id]: [] },
          }
        : {
            ...this.mediaState(),
            pillars: { ...this.mediaState().pillars, [scope.id]: [] },
          };

    this.mediaState.set(nextMedia);
    await this.persistMedia(nextMedia);
  }

  async createSignedPreviewUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from('trade-screenshots')
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? 'Could not load saved screenshot');
    }

    return data.signedUrl;
  }

  mergeDraftMediaIntoAudit(form: GatekeeperFormValue) {
    return mergeDraftMediaIntoAudit(form, this.mediaState());
  }

  async deleteActiveDraft(): Promise<void> {
    const draftId = this.draftId();
    if (!draftId) {
      return;
    }

    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      return;
    }

    await this.removeDraftWithMedia(draftId, user.id, this.mediaState());
  }

  clearActive(): void {
    this.draftId.set(null);
    this.mediaState.set(EMPTY_DRAFT_MEDIA);
    this.saveStatus.set('idle');
    this.saveError.set(null);
    this.initPromise = null;
    this.initPromiseKey = null;
    this.lastWizardSnapshot = null;
    this.lastExecutionSnapshot = null;
  }

  private sessionStateFromRow(row: GatekeeperDraftRow): TradingSessionState {
    return {
      journalName: row.journal_name,
      session: row.session_context,
      symbol: row.symbol as AssetSymbol,
    };
  }

  private async ensureDraftReady(): Promise<void> {
    if (this.draftId()) {
      return;
    }

    const session = this.boundSession();
    if (!session) {
      throw new Error(
        'Complete the trading session bar first: journal name, market session, time of day, and symbol.',
      );
    }

    const initKey = this.buildInitKey(session);
    if (this.initPromise && this.initPromiseKey === initKey) {
      await this.initPromise;
      return;
    }

    this.initPromiseKey = initKey;
    this.initPromise = this.initForSession(session);

    try {
      await this.initPromise;
    } catch (err) {
      throw new Error(this.formatDraftError(err));
    } finally {
      if (this.initPromiseKey === initKey) {
        this.initPromise = null;
        this.initPromiseKey = null;
      }
    }
  }

  private buildInitKey(sessionState: TradingSessionState): string {
    return sessionState.journalName.trim();
  }

  private formatDraftError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('gatekeeper_drafts_user_journal_name_unique')) {
      return 'A journal with this name already exists. Choose a different journal name.';
    }
    if (message.includes('gatekeeper_drafts') || message.toLowerCase().includes('schema cache')) {
      return 'Cloud save is not set up yet. Apply the gatekeeper_drafts Supabase migration, then refresh.';
    }
    if (message.toLowerCase().includes('sign in') || message.toLowerCase().includes('not authenticated')) {
      return 'Sign in to save screenshots and drafts to the cloud.';
    }
    return message;
  }

  private applyLoadedDraft(row: GatekeeperDraftRow, restored: boolean): GatekeeperDraftLoadResult {
    const wizardForm = normalizeGatekeeperFormValue(row.wizard_form);
    const media = normalizeDraftMedia(row.media);
    const executionForm = normalizeExecutionFormValue(row.execution_form, row.symbol as AssetSymbol);
    const uiState: GatekeeperDraftUiState = {
      active_step: row.ui_state?.active_step ?? DEFAULT_DRAFT_UI_STATE.active_step,
      active_timeframe_tab:
        row.ui_state?.active_timeframe_tab ?? DEFAULT_DRAFT_UI_STATE.active_timeframe_tab,
    };

    this.draftId.set(row.id);
    this.mediaState.set(media);
    this.lastWizardSnapshot = { form: wizardForm, uiState };
    this.lastExecutionSnapshot = executionForm;
    this.saveStatus.set('saved');
    this.saveError.set(null);

    return {
      draftId: row.id,
      restored,
      journalName: row.journal_name,
      tradingDate: row.trading_date,
      symbol: row.symbol as AssetSymbol,
      sessionContext: row.session_context,
      wizardForm,
      media,
      uiState,
      executionForm,
    };
  }

  private startSaveQueue(): void {
    if (this.saveSubscriptionStarted) {
      return;
    }
    this.saveSubscriptionStarted = true;

    this.saveQueue.pipe(debounceTime(SAVE_DEBOUNCE_MS)).subscribe(() => {
      void this.flushSave();
    });
  }

  private async flushSave(): Promise<void> {
    const draftId = this.draftId();
    if (!draftId || (!this.lastWizardSnapshot && !this.lastExecutionSnapshot)) {
      return;
    }

    this.saveStatus.set('saving');
    this.saveError.set(null);

    const session = this.boundSession();
    const payload: {
      wizard_form?: GatekeeperFormValue;
      ui_state?: GatekeeperDraftUiState;
      execution_form?: ExecutionFormValue;
      media: GatekeeperDraftMedia;
      trading_date?: string;
      symbol?: AssetSymbol;
      session_context?: TradingSessionState['session'];
      journal_name?: string;
    } = {
      media: this.mediaState(),
    };

    if (this.lastWizardSnapshot) {
      payload.wizard_form = this.lastWizardSnapshot.form;
      payload.ui_state = this.lastWizardSnapshot.uiState;
    }

    if (this.lastExecutionSnapshot) {
      payload.execution_form = this.lastExecutionSnapshot;
    }

    if (session) {
      payload.trading_date = session.session.trading_date;
      payload.symbol = session.symbol;
      payload.session_context = session.session;
      payload.journal_name = session.journalName.trim();
    }

    const { error } = await this.supabase.client.from('gatekeeper_drafts').update(payload).eq('id', draftId);

    if (error) {
      this.saveStatus.set('error');
      this.saveError.set(error.message);
      return;
    }

    this.saveStatus.set('saved');
  }

  private async persistMedia(media: GatekeeperDraftMedia): Promise<void> {
    const draftId = this.draftId();
    if (!draftId) {
      return;
    }

    const { error } = await this.supabase.client
      .from('gatekeeper_drafts')
      .update({ media })
      .eq('id', draftId);

    if (error) {
      this.saveStatus.set('error');
      this.saveError.set(error.message);
      throw new Error(error.message);
    }

    this.saveStatus.set('saved');
  }

  private async uploadScopedFile(
    userId: string,
    draftId: string,
    scope: JournalScreenshotScope,
    file: File,
    isAnnotated: boolean,
  ): Promise<TimeframeScreenshotRef> {
    const buildPath =
      scope.kind === 'htf'
        ? (fileName: string) =>
            this.mediaService.buildHtfStoragePath(userId, draftId, scope.id as AnalyzedTimeframe, fileName)
        : (fileName: string) =>
            this.mediaService.buildPillarStoragePath(userId, draftId, scope.id as PillarStepKey, fileName);

    const storagePath = buildPath(file.name);
    const { error } = await this.supabase.client.storage.from('trade-screenshots').upload(storagePath, file, {
      contentType: file.type || 'image/png',
      upsert: false,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || 'image/png',
      is_annotated: isAnnotated,
    };
  }

  private appendMediaRef(scope: JournalScreenshotScope, ref: TimeframeScreenshotRef): GatekeeperDraftMedia {
    const current = this.mediaState();

    if (scope.kind === 'htf') {
      const tf = scope.id as AnalyzedTimeframe;
      return {
        ...current,
        htf: {
          ...current.htf,
          [tf]: [...(current.htf[tf] ?? []), ref],
        },
      };
    }

    const step = scope.id as PillarStepKey;
    return {
      ...current,
      pillars: {
        ...current.pillars,
        [step]: [...(current.pillars[step] ?? []), ref],
      },
    };
  }

  private removeMediaRef(scope: JournalScreenshotScope, storagePath: string): GatekeeperDraftMedia {
    const current = this.mediaState();

    if (scope.kind === 'htf') {
      const tf = scope.id as AnalyzedTimeframe;
      return {
        ...current,
        htf: {
          ...current.htf,
          [tf]: (current.htf[tf] ?? []).filter((ref) => ref.storage_path !== storagePath),
        },
      };
    }

    const step = scope.id as PillarStepKey;
    return {
      ...current,
      pillars: {
        ...current.pillars,
        [step]: (current.pillars[step] ?? []).filter((ref) => ref.storage_path !== storagePath),
      },
    };
  }

  private async setArchivedAt(draftId: string, archivedAt: string | null): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Sign in to manage journals.');
    }

    const { data, error } = await this.supabase.client
      .from('gatekeeper_drafts')
      .update({ archived_at: archivedAt })
      .eq('id', draftId)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(this.formatDraftError(error.message));
    }

    if (!data) {
      throw new Error('Journal not found or you do not have access.');
    }

    if (this.draftId() === draftId && archivedAt) {
      this.clearActive();
    }
  }

  private async removeDraftWithMedia(
    draftId: string,
    userId: string,
    mediaHint?: GatekeeperDraftMedia,
  ): Promise<void> {
    let media = mediaHint;
    if (!media) {
      const { data, error } = await this.supabase.client
        .from('gatekeeper_drafts')
        .select('media')
        .eq('id', draftId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new Error(this.formatDraftError(error.message));
      }

      if (!data) {
        throw new Error('Journal not found or you do not have access.');
      }

      media = normalizeDraftMedia(data.media);
    }

    const paths = this.collectMediaStoragePaths(media);
    if (paths.length > 0) {
      const { error: storageError } = await this.supabase.client.storage.from('trade-screenshots').remove(paths);
      if (storageError) {
        throw new Error(storageError.message);
      }
    }

    const { error: deleteError } = await this.supabase.client
      .from('gatekeeper_drafts')
      .delete()
      .eq('id', draftId)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(this.formatDraftError(deleteError.message));
    }

    if (this.draftId() === draftId) {
      this.clearActive();
    }
  }

  private collectMediaStoragePaths(media: GatekeeperDraftMedia): string[] {
    const paths: string[] = [];

    for (const refs of Object.values(media.htf)) {
      if (refs) {
        paths.push(...refs.map((ref) => ref.storage_path));
      }
    }

    for (const refs of Object.values(media.pillars)) {
      if (refs) {
        paths.push(...refs.map((ref) => ref.storage_path));
      }
    }

    return paths;
  }

  private async deleteStorageObject(storagePath: string): Promise<void> {
    const { error } = await this.supabase.client.storage.from('trade-screenshots').remove([storagePath]);
    if (error) {
      throw new Error(error.message);
    }
  }
}
