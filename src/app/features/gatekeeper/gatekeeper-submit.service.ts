import { Injectable, inject } from '@angular/core';

import type { AnalyzedTimeframe } from '../../core/models/database.types';
import { HtfMediaService } from '../../core/supabase/htf-media.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import type { GatekeeperSubmitPayload, GatekeeperSubmitResult } from './execution-block.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import { mapFormToHtfContext } from './htf-context.utils';
import { HtfScreenshotDraftService } from './htf-screenshot-draft.service';

@Injectable({ providedIn: 'root' })
export class GatekeeperSubmitService {
  private readonly supabase = inject(SupabaseService);
  private readonly htfMedia = inject(HtfMediaService);
  private readonly screenshotDrafts = inject(HtfScreenshotDraftService);

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
      location_thesis: form.location.location_thesis.trim(),
      behavior_thesis: form.behavior.behavior_thesis.trim(),
      confirmation_thesis: form.confirmation.confirmation_thesis.trim(),
      invalidation_thesis: form.invalidation.invalidation_thesis.trim(),
      htf_context: mapFormToHtfContext(form),
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

    const drafts = this.screenshotDrafts.getAllDrafts();
    const uploadDrafts: Partial<
      Record<
        AnalyzedTimeframe,
        { file: File; fileName: string; mimeType: string; isAnnotated: boolean }
      >
    > = {};

    for (const tf of Object.keys(drafts) as AnalyzedTimeframe[]) {
      const draft = drafts[tf];
      if (draft) {
        uploadDrafts[tf] = {
          file: draft.file,
          fileName: draft.fileName,
          mimeType: draft.mimeType,
          isAnnotated: draft.isAnnotated,
        };
      }
    }

    try {
      const enrichedContext = await this.htfMedia.attachScreenshotsToContext(
        trade.id,
        payload.audit.htf_context,
        uploadDrafts,
      );
      await this.htfMedia.updateAuditHtfContext(audit.id, enrichedContext);
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
