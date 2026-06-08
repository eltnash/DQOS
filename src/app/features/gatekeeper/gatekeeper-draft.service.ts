import { Injectable, inject, signal } from '@angular/core';
import { Subject, debounceTime } from 'rxjs';

import type {
  AnalyzedTimeframe,
  PillarStepKey,
  TimeframeScreenshotRef,
} from '../../core/models/database.types';
import { GatekeeperMediaService } from '../../core/supabase/gatekeeper-media.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import {
  defaultGatekeeperFormValue,
  mergeDraftMediaIntoAudit,
  normalizeDraftMedia,
  normalizeGatekeeperFormValue,
  screenshotRefsForScope,
} from './gatekeeper-draft.mapper';
import type {
  GatekeeperDraftLoadResult,
  GatekeeperDraftMedia,
  GatekeeperDraftRow,
  GatekeeperDraftSaveStatus,
  GatekeeperDraftUiState,
} from './gatekeeper-draft.types';
import {
  DEFAULT_DRAFT_UI_STATE,
  EMPTY_DRAFT_MEDIA,
} from './gatekeeper-draft.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import type { JournalScreenshotScope } from './gatekeeper-screenshot-draft.service';
import type { TradingSessionState } from './trading-session.types';

const SAVE_DEBOUNCE_MS = 1500;

interface PendingFormSave {
  form: GatekeeperFormValue;
  uiState: GatekeeperDraftUiState;
}

@Injectable({ providedIn: 'root' })
export class GatekeeperDraftService {
  private readonly supabase = inject(SupabaseService);
  private readonly mediaService = inject(GatekeeperMediaService);

  private readonly draftId = signal<string | null>(null);
  private readonly mediaState = signal<GatekeeperDraftMedia>(EMPTY_DRAFT_MEDIA);
  private readonly saveStatus = signal<GatekeeperDraftSaveStatus>('idle');
  private readonly saveError = signal<string | null>(null);

  private readonly saveQueue = new Subject<PendingFormSave>();
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
      throw new Error('Sign in to save your Gatekeeper draft');
    }

    const session = sessionState.session;
    const query = client
      .from('gatekeeper_drafts')
      .select('id, user_id, trading_date, symbol, session_context, wizard_form, media, ui_state, updated_at')
      .eq('user_id', user.id)
      .eq('trading_date', session.trading_date)
      .eq('symbol', sessionState.symbol)
      .eq('session_context->>market_session', session.market_session)
      .eq('session_context->>analysis_period', session.analysis_period)
      .maybeSingle();

    const { data: existing, error: fetchError } = await query;

    if (fetchError) {
      this.saveStatus.set('error');
      this.saveError.set(fetchError.message);
      throw new Error(fetchError.message);
    }

    if (existing) {
      return this.applyLoadedDraft(existing as GatekeeperDraftRow, true);
    }

    const insertPayload = {
      user_id: user.id,
      trading_date: session.trading_date,
      symbol: sessionState.symbol,
      session_context: session,
      wizard_form: defaultGatekeeperFormValue(),
      media: EMPTY_DRAFT_MEDIA,
      ui_state: DEFAULT_DRAFT_UI_STATE,
    };

    const { data: created, error: insertError } = await client
      .from('gatekeeper_drafts')
      .insert(insertPayload)
      .select('id, user_id, trading_date, symbol, session_context, wizard_form, media, ui_state, updated_at')
      .single();

    if (insertError || !created) {
      this.saveStatus.set('error');
      this.saveError.set(insertError?.message ?? 'Could not create draft');
      throw new Error(insertError?.message ?? 'Could not create draft');
    }

    return this.applyLoadedDraft(created as GatekeeperDraftRow, false);
  }

  scheduleSave(form: GatekeeperFormValue, uiState: GatekeeperDraftUiState): void {
    if (!this.draftId()) {
      return;
    }
    this.saveQueue.next({ form, uiState });
  }

  async persistScreenshot(scope: JournalScreenshotScope, itemId: string, file: File, isAnnotated = false): Promise<TimeframeScreenshotRef> {
    const draftId = this.draftId();
    if (!draftId) {
      throw new Error('No active Gatekeeper draft session');
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

    const ref = await this.persistScreenshot(scope, crypto.randomUUID(), file, true);
    return ref;
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

    await this.supabase.client.from('gatekeeper_drafts').delete().eq('id', draftId);
    this.clearActive();
  }

  clearActive(): void {
    this.draftId.set(null);
    this.mediaState.set(EMPTY_DRAFT_MEDIA);
    this.saveStatus.set('idle');
    this.saveError.set(null);
  }

  private applyLoadedDraft(row: GatekeeperDraftRow, restored: boolean): GatekeeperDraftLoadResult {
    const wizardForm = normalizeGatekeeperFormValue(row.wizard_form);
    const media = normalizeDraftMedia(row.media);
    const uiState: GatekeeperDraftUiState = {
      active_step: row.ui_state?.active_step ?? DEFAULT_DRAFT_UI_STATE.active_step,
      active_timeframe_tab:
        row.ui_state?.active_timeframe_tab ?? DEFAULT_DRAFT_UI_STATE.active_timeframe_tab,
    };

    this.draftId.set(row.id);
    this.mediaState.set(media);
    this.saveStatus.set('saved');
    this.saveError.set(null);

    return { draftId: row.id, restored, wizardForm, media, uiState };
  }

  private startSaveQueue(): void {
    if (this.saveSubscriptionStarted) {
      return;
    }
    this.saveSubscriptionStarted = true;

    this.saveQueue.pipe(debounceTime(SAVE_DEBOUNCE_MS)).subscribe((pending) => {
      void this.flushSave(pending);
    });
  }

  private async flushSave(pending: PendingFormSave): Promise<void> {
    const draftId = this.draftId();
    if (!draftId) {
      return;
    }

    this.saveStatus.set('saving');
    this.saveError.set(null);

    const { error } = await this.supabase.client
      .from('gatekeeper_drafts')
      .update({
        wizard_form: pending.form,
        ui_state: pending.uiState,
        media: this.mediaState(),
      })
      .eq('id', draftId);

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

  private async deleteStorageObject(storagePath: string): Promise<void> {
    const { error } = await this.supabase.client.storage.from('trade-screenshots').remove([storagePath]);
    if (error) {
      throw new Error(error.message);
    }
  }
}
