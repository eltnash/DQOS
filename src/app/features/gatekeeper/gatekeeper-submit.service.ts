import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '../../core/supabase/supabase.service';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import type { GatekeeperSubmitPayload, GatekeeperSubmitResult } from './execution-block.types';

@Injectable({ providedIn: 'root' })
export class GatekeeperSubmitService {
  private readonly supabase = inject(SupabaseService);

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

    return { tradeId: trade.id, auditId: audit.id };
  }
}
