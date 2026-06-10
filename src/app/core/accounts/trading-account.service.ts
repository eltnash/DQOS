import { Injectable, inject, signal } from '@angular/core';

import type { TradingAccount, TradingAccountType } from '../models/database.types';
import { SupabaseService } from '../supabase/supabase.service';

export interface TradingAccountSettingsInput {
  name: string;
  account_type: TradingAccountType;
  starting_capital: number;
  max_drawdown_pct: number;
  daily_drawdown_pct: number;
  currency?: string;
}

const ACCOUNT_SELECT =
  'id, user_id, name, account_type, currency, starting_capital, current_balance, max_drawdown_pct, daily_drawdown_pct, configured_at, created_at, updated_at';

@Injectable({ providedIn: 'root' })
export class TradingAccountService {
  private readonly supabase = inject(SupabaseService);

  private readonly accountsCache = signal<TradingAccount[]>([]);
  private readonly activeAccount = signal<TradingAccount | null>(null);

  readonly accounts = this.accountsCache.asReadonly();
  readonly active = this.activeAccount.asReadonly();

  isConfigured(account: TradingAccount): boolean {
    return account.configured_at != null;
  }

  async loadAccounts(): Promise<TradingAccount[]> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      this.accountsCache.set([]);
      return [];
    }

    const { data, error } = await this.supabase.client
      .from('trading_accounts')
      .select(ACCOUNT_SELECT)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as TradingAccount[];
    this.accountsCache.set(rows);
    return rows;
  }

  async getAccount(accountId: string): Promise<TradingAccount | null> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      return null;
    }

    const { data, error } = await this.supabase.client
      .from('trading_accounts')
      .select(ACCOUNT_SELECT)
      .eq('id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const account = (data as TradingAccount | null) ?? null;
    if (account) {
      this.activeAccount.set(account);
      this.upsertCache(account);
    }
    return account;
  }

  async createAccount(name: string, accountType: TradingAccountType): Promise<TradingAccount> {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new Error('Account name must be at least 2 characters.');
    }

    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Sign in to create an account.');
    }

    const { data, error } = await this.supabase.client
      .from('trading_accounts')
      .insert({
        user_id: user.id,
        name: trimmed,
        account_type: accountType,
      })
      .select(ACCOUNT_SELECT)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not create account.');
    }

    const account = data as TradingAccount;
    this.accountsCache.update((list) => [account, ...list]);
    return account;
  }

  async updateSettings(accountId: string, input: TradingAccountSettingsInput): Promise<TradingAccount> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Sign in to save settings.');
    }

    if (input.starting_capital <= 0) {
      throw new Error('Starting capital must be greater than zero.');
    }
    if (input.max_drawdown_pct <= 0 || input.daily_drawdown_pct <= 0) {
      throw new Error('Drawdown limits must be greater than zero.');
    }

    const existing = await this.getAccount(accountId);
    const configuredAt = existing?.configured_at ?? new Date().toISOString();

    const { data, error } = await this.supabase.client
      .from('trading_accounts')
      .update({
        name: input.name.trim(),
        account_type: input.account_type,
        currency: input.currency ?? 'USD',
        starting_capital: input.starting_capital,
        current_balance: existing?.configured_at ? existing.current_balance : input.starting_capital,
        max_drawdown_pct: input.max_drawdown_pct,
        daily_drawdown_pct: input.daily_drawdown_pct,
        configured_at: configuredAt,
      })
      .eq('id', accountId)
      .eq('user_id', user.id)
      .select(ACCOUNT_SELECT)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not save settings.');
    }

    const account = data as TradingAccount;
    this.activeAccount.set(account);
    this.upsertCache(account);
    return account;
  }

  async recalculateBalance(accountId: string): Promise<void> {
    const account = await this.getAccount(accountId);
    if (!account?.configured_at || account.starting_capital == null) {
      return;
    }

    const { data, error } = await this.supabase.client
      .from('trades')
      .select('net_profit')
      .eq('account_id', accountId)
      .eq('status', 'CLOSED');

    if (error) {
      throw new Error(error.message);
    }

    const profitSum = (data ?? []).reduce((sum, row) => sum + (Number(row.net_profit) || 0), 0);
    const balance = Number(account.starting_capital) + profitSum;

    const { data: updated, error: updateError } = await this.supabase.client
      .from('trading_accounts')
      .update({ current_balance: balance })
      .eq('id', accountId)
      .select(ACCOUNT_SELECT)
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? 'Could not update balance.');
    }

    const next = updated as TradingAccount;
    this.activeAccount.set(next);
    this.upsertCache(next);
  }

  setActiveAccount(account: TradingAccount | null): void {
    this.activeAccount.set(account);
  }

  private upsertCache(account: TradingAccount): void {
    this.accountsCache.update((list) => {
      const idx = list.findIndex((a) => a.id === account.id);
      if (idx < 0) {
        return [account, ...list];
      }
      const copy = [...list];
      copy[idx] = account;
      return copy;
    });
  }
}
