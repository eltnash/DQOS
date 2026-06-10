import { Injectable, inject, signal } from '@angular/core';

import { SupabaseService } from '../supabase/supabase.service';
import {
  evaluateAccountRisk,
  formatRiskBlockMessage,
  localTradingDateIso,
  localWeekDateRange,
  nextTimedUnlockAt,
  type AccountRiskStatus,
} from './account-risk.utils';
import { TradingAccountService } from './trading-account.service';

const EMPTY_STATUS: AccountRiskStatus = {
  blocked: false,
  violations: [],
  locks: [],
  todayNetProfit: 0,
  weekNetProfit: 0,
  maxDrawdownPct: 0,
  weeklyDrawdownPct: 0,
  dailyDrawdownPct: 0,
};

@Injectable({ providedIn: 'root' })
export class AccountRiskService {
  private readonly supabase = inject(SupabaseService);
  private readonly accountService = inject(TradingAccountService);

  private readonly statusSignal = signal<AccountRiskStatus>(EMPTY_STATUS);
  private readonly accountIdSignal = signal<string | null>(null);
  private readonly clockSignal = signal(Date.now());
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  readonly status = this.statusSignal.asReadonly();
  readonly clock = this.clockSignal.asReadonly();

  clear(): void {
    this.stopCountdown();
    this.accountIdSignal.set(null);
    this.statusSignal.set(EMPTY_STATUS);
  }

  async evaluate(accountId: string): Promise<AccountRiskStatus> {
    const account = await this.accountService.getAccount(accountId);
    if (!account || !this.accountService.isConfigured(account)) {
      this.stopCountdown();
      this.accountIdSignal.set(accountId);
      this.statusSignal.set(EMPTY_STATUS);
      return EMPTY_STATUS;
    }

    const [todayNetProfit, weekNetProfit] = await Promise.all([
      this.loadTodayNetProfit(accountId),
      this.loadWeekNetProfit(accountId),
    ]);
    const status = evaluateAccountRisk(account, todayNetProfit, weekNetProfit, new Date());
    this.accountIdSignal.set(accountId);
    this.statusSignal.set(status);
    this.syncCountdown(accountId, status);
    return status;
  }

  async assertCanRecord(accountId: string): Promise<void> {
    const status = await this.evaluate(accountId);
    if (status.blocked) {
      throw new Error(formatRiskBlockMessage(status, new Date(this.clockSignal())));
    }
  }

  refreshIfActive(accountId: string): void {
    if (this.accountIdSignal() === accountId) {
      void this.evaluate(accountId);
    }
  }

  blockMessage(): string {
    const status = this.statusSignal();
    if (!status.blocked) {
      return '';
    }
    return formatRiskBlockMessage(status, new Date(this.clockSignal()));
  }

  private syncCountdown(accountId: string, status: AccountRiskStatus): void {
    this.stopCountdown();

    if (!status.blocked || !status.locks.some((lock) => lock.unlockAt)) {
      return;
    }

    this.clockSignal.set(Date.now());
    this.countdownTimer = setInterval(() => {
      const now = Date.now();
      this.clockSignal.set(now);

      const nextUnlock = nextTimedUnlockAt(this.statusSignal());
      if (nextUnlock && now >= new Date(nextUnlock).getTime()) {
        void this.evaluate(accountId);
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
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

  private async loadWeekNetProfit(accountId: string): Promise<number> {
    const { start, end } = localWeekDateRange();

    const { data, error } = await this.supabase.client
      .from('trades')
      .select('net_profit')
      .eq('account_id', accountId)
      .eq('status', 'CLOSED')
      .gte('trading_date', start)
      .lte('trading_date', end);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).reduce((sum, row) => sum + (Number(row.net_profit) || 0), 0);
  }
}
