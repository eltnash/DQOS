import { Injectable, inject, signal } from '@angular/core';

import { SupabaseService } from '../supabase/supabase.service';
import {
  evaluateAccountRisk,
  formatRiskBlockMessage,
  localTradingDateIso,
  type AccountRiskStatus,
} from './account-risk.utils';
import { TradingAccountService } from './trading-account.service';

const EMPTY_STATUS: AccountRiskStatus = {
  blocked: false,
  violations: [],
  todayNetProfit: 0,
  maxDrawdownPct: 0,
  dailyDrawdownPct: 0,
};

@Injectable({ providedIn: 'root' })
export class AccountRiskService {
  private readonly supabase = inject(SupabaseService);
  private readonly accountService = inject(TradingAccountService);

  private readonly statusSignal = signal<AccountRiskStatus>(EMPTY_STATUS);
  private readonly accountIdSignal = signal<string | null>(null);

  readonly status = this.statusSignal.asReadonly();

  clear(): void {
    this.accountIdSignal.set(null);
    this.statusSignal.set(EMPTY_STATUS);
  }

  async evaluate(accountId: string): Promise<AccountRiskStatus> {
    const account = await this.accountService.getAccount(accountId);
    if (!account || !this.accountService.isConfigured(account)) {
      this.accountIdSignal.set(accountId);
      this.statusSignal.set(EMPTY_STATUS);
      return EMPTY_STATUS;
    }

    const todayNetProfit = await this.loadTodayNetProfit(accountId);
    const status = evaluateAccountRisk(account, todayNetProfit);
    this.accountIdSignal.set(accountId);
    this.statusSignal.set(status);
    return status;
  }

  async assertCanRecord(accountId: string): Promise<void> {
    const status = await this.evaluate(accountId);
    if (status.blocked) {
      throw new Error(formatRiskBlockMessage(status));
    }
  }

  refreshIfActive(accountId: string): void {
    if (this.accountIdSignal() === accountId) {
      void this.evaluate(accountId);
    }
  }

  private async loadTodayNetProfit(accountId: string): Promise<number> {
    const tradingDate = localTradingDateIso();

    const { data, error } = await this.supabase.client
      .from('trades')
      .select('net_profit')
      .eq('account_id', accountId)
      .eq('status', 'CLOSED')
      .eq('trading_date', tradingDate);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).reduce((sum, row) => sum + (Number(row.net_profit) || 0), 0);
  }
}
