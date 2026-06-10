import type { TradingAccount } from '../models/database.types';

export type AccountRiskViolation = 'capital_exhausted' | 'max_drawdown' | 'daily_drawdown';

export interface AccountRiskStatus {
  blocked: boolean;
  violations: AccountRiskViolation[];
  /** Closed-trade net P&amp;L for the current trading day (can be negative). */
  todayNetProfit: number;
  maxDrawdownPct: number;
  dailyDrawdownPct: number;
}

export function localTradingDateIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function evaluateAccountRisk(
  account: TradingAccount,
  todayNetProfit: number,
): AccountRiskStatus {
  const starting = Number(account.starting_capital ?? 0);
  const balance = Number(account.current_balance ?? starting);
  const maxLimit = Number(account.max_drawdown_pct ?? 0);
  const dailyLimit = Number(account.daily_drawdown_pct ?? 0);

  const violations: AccountRiskViolation[] = [];

  if (balance <= 0) {
    violations.push('capital_exhausted');
  }

  if (starting > 0) {
    const maxDrawdownPct = ((starting - balance) / starting) * 100;
    if (maxDrawdownPct >= maxLimit) {
      violations.push('max_drawdown');
    }

    const todayLoss = todayNetProfit < 0 ? Math.abs(todayNetProfit) : 0;
    const dailyDrawdownPct = (todayLoss / starting) * 100;
    if (dailyDrawdownPct >= dailyLimit) {
      violations.push('daily_drawdown');
    }

    return {
      blocked: violations.length > 0,
      violations,
      todayNetProfit,
      maxDrawdownPct,
      dailyDrawdownPct,
    };
  }

  return {
    blocked: violations.length > 0,
    violations,
    todayNetProfit,
    maxDrawdownPct: 0,
    dailyDrawdownPct: 0,
  };
}

export function riskViolationLabel(violation: AccountRiskViolation): string {
  switch (violation) {
    case 'capital_exhausted':
      return 'Account capital exhausted';
    case 'max_drawdown':
      return 'Max drawdown limit reached';
    case 'daily_drawdown':
      return 'Daily drawdown limit reached';
  }
}

export function formatRiskBlockMessage(status: AccountRiskStatus): string {
  if (!status.blocked) {
    return '';
  }

  const labels = status.violations.map(riskViolationLabel);
  return `${labels.join('. ')}. Update account rules in Settings to resume executions and new records.`;
}

export function formatRiskAlertDetail(status: AccountRiskStatus, currency = 'USD'): string {
  const money = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const details: string[] = status.violations.map(riskViolationLabel);

  if (status.violations.includes('max_drawdown')) {
    details.push(`total drawdown ${status.maxDrawdownPct.toFixed(2)}%`);
  }
  if (status.violations.includes('daily_drawdown')) {
    const loss = status.todayNetProfit < 0 ? money(Math.abs(status.todayNetProfit)) : money(0);
    details.push(`today's closed loss ${loss} (${status.dailyDrawdownPct.toFixed(2)}% of capital)`);
  }

  return `${details.join(' · ')}. Executions and new journal records are paused until you update rules in Settings.`;
}
