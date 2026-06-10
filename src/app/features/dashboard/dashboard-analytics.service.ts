import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '../../core/supabase/supabase.service';
import type { PillarJournalsSnapshot } from '../../core/models/database.types';
import type {
  EnrichedTradeRow,
  ExecutionAuditRow,
  OutcomeGalleryItem,
  ProfessionalDashboardSnapshot,
  RawTradeRow,
} from './dashboard.types';
import {
  buildAccountEquityCurve,
  buildDaySummaries,
  computeStrategyBundles,
  enrichTrades,
} from './trading-metrics.utils';

@Injectable({ providedIn: 'root' })
export class DashboardAnalyticsService {
  private readonly supabase = inject(SupabaseService);

  async loadSnapshot(
    accountId: string,
    startingCapital: number,
  ): Promise<ProfessionalDashboardSnapshot> {
    const rawTrades = await this.loadClosedTrades(accountId);
    const audits = await this.loadAudits(rawTrades.map((t) => t.id));
    const trades = enrichTrades(rawTrades, audits);
    const outcomeGallery = await this.buildOutcomeGallery(trades, audits);

    return {
      trades,
      strategyBundles: computeStrategyBundles(trades),
      accountEquityCurve: buildAccountEquityCurve(trades, startingCapital),
      daySummaries: buildDaySummaries(trades),
      outcomeGallery,
    };
  }

  private async loadClosedTrades(accountId: string): Promise<RawTradeRow[]> {
    const { data, error } = await this.supabase.client
      .from('trades')
      .select(
        `id, auction_strategy, day_type, trading_date, net_profit, r_multiple, closed_at,
         symbol, direction, entry_price, stop_price, exit_price, size, process_compliance_pct`,
      )
      .eq('account_id', accountId)
      .eq('status', 'CLOSED')
      .order('closed_at', { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      ...(row as Omit<RawTradeRow, 'location' | 'behavior' | 'confirmation' | 'invalidation_level' | 'invalidation_price'>),
      location: null,
      behavior: null,
      confirmation: null,
      invalidation_level: null,
      invalidation_price: null,
    }));
  }

  private async loadAudits(tradeIds: string[]): Promise<Map<string, ExecutionAuditRow>> {
    if (tradeIds.length === 0) return new Map();

    const { data, error } = await this.supabase.client
      .from('execution_audits')
      .select(
        'trade_id, location, behavior, confirmation, invalidation_level, invalidation_price, pillar_journals',
      )
      .in('trade_id', tradeIds);

    if (error) return new Map();

    const map = new Map<string, ExecutionAuditRow>();
    for (const row of (data ?? []) as ExecutionAuditRow[]) {
      map.set(row.trade_id, row);
    }
    return map;
  }

  private async buildOutcomeGallery(
    trades: EnrichedTradeRow[],
    audits: Map<string, ExecutionAuditRow>,
  ): Promise<OutcomeGalleryItem[]> {
    const winners = [...trades]
      .filter((t) => Number(t.net_profit ?? 0) > 0)
      .sort((a, b) => (b.closed_at ?? b.trading_date).localeCompare(a.closed_at ?? a.trading_date))
      .slice(0, 12);

    const items: OutcomeGalleryItem[] = [];
    for (const trade of winners) {
      const screenshot = audits.get(trade.id)?.pillar_journals?.outcome?.screenshots?.[0];
      if (!screenshot?.storage_path) continue;
      try {
        const imageUrl = await this.signedUrl(screenshot.storage_path);
        items.push({
          tradeId: trade.id,
          strategy: trade.auction_strategy,
          tradingDate: trade.trading_date,
          netProfit: Number(trade.net_profit ?? 0),
          symbol: trade.symbol,
          imageUrl,
          fileName: screenshot.file_name,
        });
      } catch {
        // skip
      }
    }
    return items;
  }

  private async signedUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from('trade-screenshots')
      .createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? 'Could not load screenshot');
    }
    return data.signedUrl;
  }
}
