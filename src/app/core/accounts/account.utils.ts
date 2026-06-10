import type { TradingAccount } from '../models/database.types';

export function formatAccountBalance(account: TradingAccount): string {
  if (!account.configured_at || account.current_balance == null) {
    return 'Set up capital';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: account.currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(account.current_balance));
}

export function accountTypeLabel(type: TradingAccount['account_type']): string {
  return type === 'demo' ? 'Demo' : 'Live';
}
