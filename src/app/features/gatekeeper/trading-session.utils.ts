import type { TradeSessionContext, TradingSessionFormValue } from './trading-session.types';

export function defaultBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatTradingDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mapSessionFormToContext(form: TradingSessionFormValue): TradeSessionContext {
  if (
    !form.trading_date ||
    !form.market_session ||
    !form.analysis_period ||
    !form.analysis_recorded_at ||
    !form.timezone
  ) {
    throw new Error('Incomplete trading session');
  }

  return {
    trading_date: formatTradingDate(form.trading_date),
    market_session: form.market_session,
    analysis_period: form.analysis_period,
    analysis_recorded_at: form.analysis_recorded_at.toISOString(),
    timezone: form.timezone,
  };
}

export function formatSessionClock(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function formatSessionSummary(session: TradeSessionContext, symbol: string): string {
  return `${session.trading_date} · ${symbol} · ${session.market_session} · ${session.analysis_period}`;
}
