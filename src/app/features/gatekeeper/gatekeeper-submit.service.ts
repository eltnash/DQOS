import { Injectable, inject } from '@angular/core';

import type { PillarStepKey } from '../../core/models/database.types';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { taggedNotesPlainText } from '../../shared/components/tagged-notes-editor/tagged-notes.utils';
import type { GatekeeperSubmitPayload, GatekeeperSubmitResult } from './execution-block.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import { GatekeeperDraftService } from './gatekeeper-draft.service';
import { GatekeeperScreenshotDraftService } from './gatekeeper-screenshot-draft.service';

@Injectable({ providedIn: 'root' })
export class GatekeeperSubmitService {
  private readonly supabase = inject(SupabaseService);
  private readonly screenshotDrafts = inject(GatekeeperScreenshotDraftService);
  private readonly draftService = inject(GatekeeperDraftService);

  mapFormToAudit(form: GatekeeperFormValue): GatekeeperSubmitPayload['audit'] {
    const location = form.location.location;
    const behavior = form.behavior.behavior;
    const confirmation = form.confirmation.confirmation;
    const invalidationPrice = form.invalidation.invalidation_price;

    if (!location || !behavior || !confirmation || invalidationPrice == null) {
      throw new Error('Incomplete pillar data');
    }

    const { htf_context, pillar_journals } = this.draftService.mergeDraftMediaIntoAudit(form);

    return {
      location,
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
        status: 'OPEN',
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

    this.screenshotDrafts.clearAll();
    this.draftService.clearActive();

    return { tradeId: trade.id, auditId: audit.id };
  }

  private assertDraftMediaComplete(form: GatekeeperFormValue): void {
    const { htf_context, pillar_journals } = this.draftService.mergeDraftMediaIntoAudit(form);

    for (const entry of htf_context.timeframe_entries) {
      if (!entry.screenshots.length) {
        throw new Error(`Missing saved screenshot for ${entry.timeframe}`);
      }
    }

    const steps: PillarStepKey[] = ['location', 'behavior', 'confirmation', 'invalidation'];
    for (const step of steps) {
      if (!pillar_journals[step].screenshots.length) {
        throw new Error(`Missing saved screenshot for ${step} pillar`);
      }
    }
  }
}
