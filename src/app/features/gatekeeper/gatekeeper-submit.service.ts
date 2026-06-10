import { Injectable, inject } from '@angular/core';

import type { PillarJournalsSnapshot, PillarStepJournal } from '../../core/models/database.types';
import { GatekeeperMediaService, type ScreenshotUploadDraft } from '../../core/supabase/gatekeeper-media.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { taggedNotesPlainText } from '../../shared/components/tagged-notes-editor/tagged-notes.utils';
import type { GatekeeperSubmitPayload, GatekeeperSubmitResult } from './execution-block.types';
import type { GatekeeperFormValue, OutcomeStepValue } from './gatekeeper-form.types';
import { GatekeeperDraftService } from './gatekeeper-draft.service';
import { GatekeeperScreenshotDraftService } from './gatekeeper-screenshot-draft.service';
import { QUALIFICATION_PILLAR_KEYS } from './pillar-context.utils';

@Injectable({ providedIn: 'root' })
export class GatekeeperSubmitService {
  private readonly supabase = inject(SupabaseService);
  private readonly screenshotDrafts = inject(GatekeeperScreenshotDraftService);
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly mediaService = inject(GatekeeperMediaService);

  mapFormToAudit(form: GatekeeperFormValue): GatekeeperSubmitPayload['audit'] {
    const locations = form.location.locations;
    const behavior = form.behavior.behavior;
    const confirmation = form.confirmation.confirmation;
    const invalidationPrice = form.invalidation.invalidation_price;

    if (locations.length === 0 || !behavior || !confirmation || invalidationPrice == null) {
      throw new Error('Incomplete pillar data');
    }

    const { htf_context, pillar_journals } = this.draftService.mergeDraftMediaIntoAudit(form);

    return {
      location: locations[0],
      locations,
      behavior,
      confirmation,
      invalidation_level: form.invalidation.invalidation_level.trim(),
      invalidation_price: invalidationPrice,
      is_retest: true,
      location_thesis: taggedNotesPlainText(form.location.notes_content),
      behavior_thesis: taggedNotesPlainText(form.behavior.notes_content),
      confirmation_thesis: taggedNotesPlainText(form.confirmation.notes_content),
      invalidation_thesis: taggedNotesPlainText(form.invalidation.notes_content),
      htf_context,
      pillar_journals,
    };
  }

  async submitQualifiedTrade(
    payload: GatekeeperSubmitPayload,
    form: GatekeeperFormValue,
  ): Promise<GatekeeperSubmitResult> {
    if (payload.trade.readiness_pct_at_entry !== 100) {
      throw new Error('STRATEGY NOT FULLY QUALIFIED — readiness must be 100%');
    }

    if (payload.audit.is_retest !== true) {
      throw new Error('Retest required — the first test provides context, not execution');
    }

    const draftId = this.draftService.activeDraftId();
    if (!draftId) {
      throw new Error('No saved Gatekeeper session — refresh and try again');
    }

    this.assertDraftMediaComplete(form);

    const client = this.supabase.client;
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: trade, error: tradeError } = await client
      .from('trades')
      .insert({
        id: draftId,
        user_id: user.id,
        status: payload.trade.status,
        readiness_pct_at_entry: 100,
        symbol: payload.trade.symbol,
        direction: payload.trade.direction,
        day_type: payload.trade.day_type,
        entry_price: payload.trade.entry_price,
        stop_price: payload.trade.stop_price,
        size: payload.trade.size,
        notes: payload.trade.notes,
        trading_date: payload.trade.trading_date,
        session_context: payload.trade.session_context,
        opened_at: payload.trade.opened_at ?? new Date().toISOString(),
        closed_at: payload.trade.closed_at ?? null,
        exit_price: payload.trade.exit_price ?? null,
        commissions: payload.trade.commissions ?? 0,
        net_profit: payload.trade.net_profit ?? null,
      })
      .select('id')
      .single();

    if (tradeError || !trade) {
      throw new Error(tradeError?.message ?? 'Trade insert failed');
    }

    const { data: audit, error: auditError } = await client
      .from('execution_audits')
      .insert({
        trade_id: trade.id,
        ...payload.audit,
      })
      .select('id')
      .single();

    if (auditError || !audit) {
      await client.from('trades').delete().eq('id', trade.id);
      throw new Error(auditError?.message ?? 'Audit insert failed — trade rolled back');
    }

    const { error: draftDeleteError } = await client.from('gatekeeper_drafts').delete().eq('id', draftId);

    if (draftDeleteError) {
      await client.from('execution_audits').delete().eq('id', audit.id);
      await client.from('trades').delete().eq('id', trade.id);
      throw new Error(draftDeleteError.message);
    }

    return { tradeId: trade.id, auditId: audit.id };
  }

  async saveOutcomeJournal(
    auditId: string,
    tradeId: string,
    outcome: OutcomeStepValue,
  ): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const draftItems = this.toUploadDrafts(this.screenshotDrafts.getItems({ kind: 'pillar', id: 'outcome' }));
    if (!draftItems.length) {
      throw new Error('Add at least one outcome screenshot');
    }

    const { data: audit, error: fetchError } = await this.supabase.client
      .from('execution_audits')
      .select('pillar_journals')
      .eq('id', auditId)
      .single();

    if (fetchError || !audit) {
      throw new Error(fetchError?.message ?? 'Could not load audit for outcome');
    }

    const current = audit.pillar_journals as PillarJournalsSnapshot;
    const outcomeJournal: PillarStepJournal = {
      focus_timeframe: outcome.focus_timeframe,
      notes: taggedNotesPlainText(outcome.notes_content),
      note_tags: outcome.notes_content.tags,
      screenshots: [],
    };

    const outcomeWithScreens = await this.mediaService.attachPillarStepScreenshots(
      user.id,
      tradeId,
      'outcome',
      outcomeJournal,
      draftItems,
    );

    await this.mediaService.updateAuditPillarJournals(auditId, {
      ...current,
      outcome: outcomeWithScreens,
    });
  }

  finalizeSubmittedJournal(): void {
    this.screenshotDrafts.clearAll();
    this.draftService.clearActive();
  }

  private toUploadDrafts(
    items: ReturnType<GatekeeperScreenshotDraftService['getItems']>,
  ): ScreenshotUploadDraft[] {
    return items.map((item) => {
      if (!item.file) {
        throw new Error(`Outcome screenshot "${item.fileName}" is missing its file data`);
      }

      return {
        file: item.file,
        fileName: item.fileName,
        mimeType: item.mimeType,
        isAnnotated: item.isAnnotated,
      };
    });
  }

  private assertDraftMediaComplete(form: GatekeeperFormValue): void {
    const { htf_context, pillar_journals } = this.draftService.mergeDraftMediaIntoAudit(form);

    for (const entry of htf_context.timeframe_entries) {
      if (!entry.screenshots.length) {
        throw new Error(`Missing saved screenshot for ${entry.timeframe}`);
      }
    }

    for (const step of QUALIFICATION_PILLAR_KEYS) {
      if (!pillar_journals[step].screenshots.length) {
        throw new Error(`Missing saved screenshot for ${step} pillar`);
      }
    }
  }
}
