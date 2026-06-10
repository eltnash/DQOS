import type { TradingAccount } from '../models/database.types';

export type AccountRiskViolation =
  | 'capital_exhausted'
  | 'max_drawdown'
  | 'weekly_drawdown'
  | 'daily_drawdown';

export interface AccountRiskLock {
  violation: AccountRiskViolation;
  /** ISO timestamp when a timed lock lifts; null when Settings reset is required. */
  unlockAt: string | null;
  requiresSettingsReset: boolean;
}

export interface AccountRiskStatus {
  blocked: boolean;
  violations: AccountRiskViolation[];
  locks: AccountRiskLock[];
  /** Closed-trade net P&amp;L for the current trading day (can be negative). */
  todayNetProfit: number;
  /** Closed-trade net P&amp;L for the current trading week (Mon–Fri, can be negative). */
  weekNetProfit: number;
  maxDrawdownPct: number;
  weeklyDrawdownPct: number;
  dailyDrawdownPct: number;
}

export function localTradingDateIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Trading week Mon–Fri in the user's local timezone. Sat/Sun use the prior Mon–Fri window. */
export function localWeekDateRange(date = new Date()): { start: string; end: string } {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = cursor.getDay();

  if (weekday === 0) {
    cursor.setDate(cursor.getDate() - 2);
  } else if (weekday === 6) {
    cursor.setDate(cursor.getDate() - 1);
  }

  const adjustedWeekday = cursor.getDay();
  const daysFromMonday = adjustedWeekday === 0 ? 6 : adjustedWeekday - 1;
  const monday = new Date(cursor);
  monday.setDate(cursor.getDate() - daysFromMonday);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return {
    start: localTradingDateIso(monday),
    end: localTradingDateIso(friday),
  };
}

/** Midnight at the start of the next local calendar day. */
export function startOfNextLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

/** Monday 00:00 local time when the next Mon–Fri trading week begins. */
export function startOfNextTradingWeek(date = new Date()): Date {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = cursor.getDay();
  const daysUntilMonday = weekday === 0 ? 1 : 8 - weekday;
  cursor.setDate(cursor.getDate() + daysUntilMonday);
  return cursor;
}

const SETTINGS_RESET_VIOLATIONS = new Set<AccountRiskViolation>([
  'capital_exhausted',
  'max_drawdown',
]);

export function buildAccountRiskLocks(
  violations: AccountRiskViolation[],
  now = new Date(),
): AccountRiskLock[] {
  return violations.map((violation) => {
    if (SETTINGS_RESET_VIOLATIONS.has(violation)) {
      return {
        violation,
        unlockAt: null,
        requiresSettingsReset: true,
      };
    }

    const unlockAt =
      violation === 'daily_drawdown'
        ? startOfNextLocalDay(now)
        : startOfNextTradingWeek(now);

    return {
      violation,
      unlockAt: unlockAt.toISOString(),
      requiresSettingsReset: false,
    };
  });
}

export function evaluateAccountRisk(
  account: TradingAccount,
  todayNetProfit: number,
  weekNetProfit: number,
  now = new Date(),
): AccountRiskStatus {
  const starting = Number(account.starting_capital ?? 0);
  const balance = Number(account.current_balance ?? starting);
  const maxLimit = Number(account.max_drawdown_pct ?? 0);
  const weeklyLimit = Number(account.weekly_drawdown_pct ?? 0);
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

    const weekLoss = weekNetProfit < 0 ? Math.abs(weekNetProfit) : 0;
    const weeklyDrawdownPct = (weekLoss / starting) * 100;
    if (weeklyDrawdownPct >= weeklyLimit) {
      violations.push('weekly_drawdown');
    }

    const todayLoss = todayNetProfit < 0 ? Math.abs(todayNetProfit) : 0;
    const dailyDrawdownPct = (todayLoss / starting) * 100;
    if (dailyDrawdownPct >= dailyLimit) {
      violations.push('daily_drawdown');
    }

    return {
      blocked: violations.length > 0,
      violations,
      locks: buildAccountRiskLocks(violations, now),
      todayNetProfit,
      weekNetProfit,
      maxDrawdownPct,
      weeklyDrawdownPct,
      dailyDrawdownPct,
    };
  }

  return {
    blocked: violations.length > 0,
    violations,
    locks: buildAccountRiskLocks(violations, now),
    todayNetProfit,
    weekNetProfit,
    maxDrawdownPct: 0,
    weeklyDrawdownPct: 0,
    dailyDrawdownPct: 0,
  };
}

export function riskViolationLabel(violation: AccountRiskViolation): string {
  switch (violation) {
    case 'capital_exhausted':
      return 'Account capital exhausted';
    case 'max_drawdown':
      return 'Max drawdown limit reached';
    case 'weekly_drawdown':
      return 'Weekly drawdown limit reached';
    case 'daily_drawdown':
      return 'Daily drawdown limit reached';
  }
}

export function formatUnlockCountdown(unlockAt: string | Date, now = new Date()): string {
  const target = unlockAt instanceof Date ? unlockAt : new Date(unlockAt);
  const ms = target.getTime() - now.getTime();

  if (ms <= 0) {
    return 'Checking unlock…';
  }

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export function formatRiskLockLine(lock: AccountRiskLock, now = new Date()): string {
  const label = riskViolationLabel(lock.violation);

  if (lock.requiresSettingsReset) {
    return `${label} — locked until you update limits in Settings`;
  }

  if (!lock.unlockAt) {
    return `${label} — locked`;
  }

  return `${label} — unlocks in ${formatUnlockCountdown(lock.unlockAt, now)}`;
}

export function nextTimedUnlockAt(status: AccountRiskStatus): string | null {
  const timed = status.locks
    .filter((lock) => lock.unlockAt && !lock.requiresSettingsReset)
    .map((lock) => lock.unlockAt as string);

  if (timed.length === 0) {
    return null;
  }

  return timed.reduce((earliest, current) =>
    new Date(current).getTime() < new Date(earliest).getTime() ? current : earliest,
  );
}

export function formatRiskBlockMessage(status: AccountRiskStatus, now = new Date()): string {
  if (!status.blocked) {
    return '';
  }

  const lines = status.locks.map((lock) => formatRiskLockLine(lock, now));
  return `${lines.join('. ')}. Executions and new journal records are paused.`;
}

export function formatRiskMetricsDetail(status: AccountRiskStatus, currency = 'USD'): string {
  const money = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const details: string[] = [];

  if (status.violations.includes('max_drawdown')) {
    details.push(`total drawdown ${status.maxDrawdownPct.toFixed(2)}%`);
  }
  if (status.violations.includes('weekly_drawdown')) {
    const loss = status.weekNetProfit < 0 ? money(Math.abs(status.weekNetProfit)) : money(0);
    details.push(`Mon–Fri closed loss ${loss} (${status.weeklyDrawdownPct.toFixed(2)}% of capital)`);
  }
  if (status.violations.includes('daily_drawdown')) {
    const loss = status.todayNetProfit < 0 ? money(Math.abs(status.todayNetProfit)) : money(0);
    details.push(`today's closed loss ${loss} (${status.dailyDrawdownPct.toFixed(2)}% of capital)`);
  }

  return details.join(' · ');
}

export function formatRiskAlertDetail(status: AccountRiskStatus, currency = 'USD', now = new Date()): string {
  const lockLines = status.locks.map((lock) => formatRiskLockLine(lock, now));
  const metrics = formatRiskMetricsDetail(status, currency);
  const parts = [...lockLines];
  if (metrics) {
    parts.push(metrics);
  }
  return parts.join(' · ');
}

export interface RiskLimitUsage {
  key: 'daily' | 'weekly' | 'max';
  label: string;
  periodLabel: string;
  usedPct: number;
  limitPct: number;
  breached: boolean;
}

export function buildRiskLimitUsage(
  account: TradingAccount,
  status: AccountRiskStatus,
): RiskLimitUsage[] {
  return [
    {
      key: 'daily',
      label: 'Daily drawdown',
      periodLabel: 'Today',
      usedPct: status.dailyDrawdownPct,
      limitPct: Number(account.daily_drawdown_pct ?? 0),
      breached: status.violations.includes('daily_drawdown'),
    },
    {
      key: 'weekly',
      label: 'Weekly drawdown',
      periodLabel: 'Mon–Fri',
      usedPct: status.weeklyDrawdownPct,
      limitPct: Number(account.weekly_drawdown_pct ?? 0),
      breached: status.violations.includes('weekly_drawdown'),
    },
    {
      key: 'max',
      label: 'Max drawdown',
      periodLabel: 'All time',
      usedPct: status.maxDrawdownPct,
      limitPct: Number(account.max_drawdown_pct ?? 0),
      breached: status.violations.includes('max_drawdown'),
    },
  ];
}

export function riskUsageProgress(usedPct: number, limitPct: number): number {
  if (limitPct <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((usedPct / limitPct) * 100));
}

export function riskUsageSeverity(usedPct: number, limitPct: number): 'success' | 'warn' | 'danger' {
  const progress = riskUsageProgress(usedPct, limitPct);
  if (progress >= 100) {
    return 'danger';
  }
  if (progress >= 80) {
    return 'warn';
  }
  return 'success';
}
