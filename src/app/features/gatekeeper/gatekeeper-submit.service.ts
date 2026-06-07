import { Injectable, inject } from '@angular/core';

import type { AnalyzedTimeframe, PillarStepKey } from '../../core/models/database.types';
import { GatekeeperMediaService } from '../../core/supabase/gatekeeper-media.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { taggedNotesPlainText } from '../../shared/components/tagged-notes-editor/tagged-notes.utils';
import type { GatekeeperSubmitPayload, GatekeeperSubmitResult } from './execution-block.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import { GatekeeperScreenshotDraftService } from './gatekeeper-screenshot-draft.service';
import { mapFormToHtfContext } from './htf-context.utils';
import { mapFormToPillarJournals } from './pillar-context.utils';

@Injectable({ providedIn: 'root' })
export class GatekeeperSubmitService {
  private readonly supabase = inject(SupabaseService);
  private readonly media = inject(GatekeeperMediaService);
  private readonly screenshotDrafts = inject(GatekeeperScreenshotDraftService);

  mapFormToAudit(form: GatekeeperFormValue): GatekeeperSubmitPayload['audit'] {
    const location = form.location.location;
    const behavior = form.behavior.behavior;
    const confirmation = form.confirmation.confirmation;
    const invalidationPrice = form.invalidation.invalidation_price;

    if (!location || !behavior || !confirmation || invalidationPrice == null) {
      throw new Error('Incomplete pillar data');
    }

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
      htf_context: mapFormToHtfContext(form),
      pillar_journals: mapFormToPillarJournals(form),
    };
  }

  async submitQualifiedTrade(payload: GatekeeperSubmitPayload): Promise<GatekeeperSubmitResult> {
    if (payload.trade.readiness_pct_at_entry !== 100) {
      throw new Error('STRATEGY NOT FULLY QUALIFIED — readiness must be 100%');
    }

    if (payload.audit.is_retest !== true) {
      throw new Error('Retest required — the first test provides context, not execution');
    }

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

    const htfDrafts = this.screenshotDrafts.getHtfDrafts();
    const pillarDrafts = this.screenshotDrafts.getPillarDrafts();

    const mapDraftItems = (
      items: { file: File; fileName: string; mimeType: string; isAnnotated: boolean }[],
    ) =>
      items.map((item) => ({
        file: item.file,
        fileName: item.fileName,
        mimeType: item.mimeType,
        isAnnotated: item.isAnnotated,
      }));

    const htfUploadDrafts: Partial<Record<AnalyzedTimeframe, ReturnType<typeof mapDraftItems>[number][]>> =
      {};
    for (const tf of Object.keys(htfDrafts) as AnalyzedTimeframe[]) {
      const items = htfDrafts[tf];
      if (items?.length) {
        htfUploadDrafts[tf] = mapDraftItems(items);
      }
    }

    const pillarUploadDrafts: Partial<Record<PillarStepKey, ReturnType<typeof mapDraftItems>[number][]>> =
      {};
    for (const step of Object.keys(pillarDrafts) as PillarStepKey[]) {
      const items = pillarDrafts[step];
      if (items?.length) {
        pillarUploadDrafts[step] = mapDraftItems(items);
      }
    }

    try {
      const enrichedContext = await this.media.attachHtfScreenshots(
        trade.id,
        payload.audit.htf_context,
        htfUploadDrafts,
      );
      const enrichedPillars = await this.media.attachPillarScreenshots(
        trade.id,
        payload.audit.pillar_journals,
        pillarUploadDrafts,
      );
      await this.media.updateAuditHtfContext(audit.id, enrichedContext);
      await this.media.updateAuditPillarJournals(audit.id, enrichedPillars);
      this.screenshotDrafts.clearAll();
    } catch (err) {
      await client.from('execution_audits').delete().eq('id', audit.id);
      await client.from('trades').delete().eq('id', trade.id);
      const message = err instanceof Error ? err.message : 'Screenshot upload failed';
      throw new Error(`${message} — trade rolled back`);
    }

    return { tradeId: trade.id, auditId: audit.id };
  }
}
