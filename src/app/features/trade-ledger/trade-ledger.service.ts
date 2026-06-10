import { Injectable, inject } from '@angular/core';

import type { AssetSymbol, AuctionStrategy } from '../../core/models/database.types';
import { SupabaseService } from '../../core/supabase/supabase.service';
import {
  normalizeExecutionFormValue,
  normalizeGatekeeperFormValue,
} from '../gatekeeper/gatekeeper-draft.mapper';
import {
  TRADE_LEDGER_PAGE_SIZE,
  type TradeLedgerPage,
  type TradeLedgerRow,
} from './trade-ledger.types';
import { pricesMatch } from './trade-ledger.utils';

interface TradeRow {
  id: string;
  symbol: AssetSymbol;
  direction: 'LONG' | 'SHORT';
  auction_strategy: AuctionStrategy | null;
  opened_at: string;
  closed_at: string | null;
  entry_price: number | null;
  stop_price: number | null;
  exit_price: number | null;
  size: number | null;
  commissions: number;
  net_profit: number | null;
  notes: string | null;
  status: string;
}

interface DraftExecutionRow {
  id: string;
  journal_name: string;
  execution_form: unknown;
  wizard_form: unknown;
}

@Injectable({ providedIn: 'root' })
export class TradeLedgerService {
  private readonly supabase = inject(SupabaseService);

  private boundAccountId: string | null = null;

  bindAccount(accountId: string | null): void {
    this.boundAccountId = accountId;
  }

  private requireAccountId(): string {
    if (!this.boundAccountId) {
      throw new Error('No trading account selected.');
    }
    return this.boundAccountId;
  }

  async listPage(page: number, pageSize = TRADE_LEDGER_PAGE_SIZE): Promise<TradeLedgerPage> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();

    if (!user) {
      return { rows: [], totalCount: 0, page, pageSize };
    }

    const accountId = this.requireAccountId();
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data: trades, error, count } = await this.supabase.client
      .from('trades')
      .select(
        'id, symbol, direction, auction_strategy, opened_at, closed_at, entry_price, stop_price, exit_price, size, commissions, net_profit, notes, status',
        { count: 'exact' },
      )
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .in('status', ['OPEN', 'CLOSED'])
      .order('opened_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const tradeRows = (trades ?? []) as TradeRow[];
    const executionByTradeId = await this.loadExecutionForms(tradeRows.map((row) => row.id));

    return {
      rows: tradeRows.map((trade) => this.toLedgerRow(trade, executionByTradeId.get(trade.id))),
      totalCount: count ?? 0,
      page,
      pageSize,
    };
  }

  private async loadExecutionForms(tradeIds: string[]): Promise<Map<string, DraftExecutionRow>> {
    const map = new Map<string, DraftExecutionRow>();
    if (tradeIds.length === 0) {
      return map;
    }

    const { data, error } = await this.supabase.client
      .from('gatekeeper_drafts')
      .select('id, journal_name, execution_form, wizard_form')
      .in('id', tradeIds);

    if (error) {
      return map;
    }

    for (const row of data ?? []) {
      map.set(row.id, row as DraftExecutionRow);
    }

    return map;
  }

  private toLedgerRow(
    trade: TradeRow,
    draft: DraftExecutionRow | undefined,
  ): TradeLedgerRow {
    const execution = normalizeExecutionFormValue(draft?.execution_form, trade.symbol);
    const wizardForm = draft?.wizard_form
      ? normalizeGatekeeperFormValue(draft.wizard_form)
      : null;
    const auctionStrategy =
      trade.auction_strategy ?? wizardForm?.behavior.auction_strategy ?? null;
    const exitPrice = execution.exit_price ?? trade.exit_price;
    const stopLoss = execution.stop_price ?? trade.stop_price;
    const takeProfit = execution.take_profit_price;

    return {
      tradeId: trade.id,
      journalId: trade.id,
      journalName: draft?.journal_name ?? null,
      auctionStrategy,
      entryTime: execution.entry_time ?? trade.opened_at,
      ticket: execution.ticket ?? trade.id.slice(0, 12),
      side: trade.direction === 'LONG' ? 'buy' : 'sell',
      volume: execution.volume ?? (trade.size != null ? trade.size : null),
      symbol: trade.symbol,
      entryPrice: execution.entry_price ?? trade.entry_price,
      stopLoss,
      takeProfit,
      exitTime: execution.exit_time ?? trade.closed_at,
      exitPrice,
      commission: execution.commission ?? trade.commissions ?? 0,
      fee: execution.fee ?? 0,
      swap: execution.swap ?? 0,
      profit: execution.profit ?? trade.net_profit,
      comment: execution.comment ?? this.commentFromNotes(trade.notes),
      closedAtStop: pricesMatch(exitPrice, stopLoss),
      closedAtTakeProfit: pricesMatch(exitPrice, takeProfit),
    };
  }

  private commentFromNotes(notes: string | null): string | null {
    if (!notes) {
      return null;
    }

    const commentPart = notes
      .split('|')
      .map((part) => part.trim())
      .find((part) => !part.startsWith('Type:') && !part.startsWith('Ticket:') && !part.startsWith('Volume:') && !part.startsWith('Fee:') && !part.startsWith('Swap:'));

    return commentPart ?? null;
  }
}
