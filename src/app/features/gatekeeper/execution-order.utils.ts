import type { PlatformOrderType, TradeDirection } from '../../core/models/database.types';
import type { ExecutionFormValue } from './execution-block.types';

export function tradeDirectionFromOrderType(
  orderType: PlatformOrderType,
  marketSide: TradeDirection,
): TradeDirection {
  switch (orderType) {
    case 'Market_Execution_Buy':
    case 'Buy_Limit':
    case 'Buy_Stop':
    case 'Buy_Stop_Limit':
      return 'LONG';
    case 'Market_Execution_Sell':
    case 'Sell_Limit':
    case 'Sell_Stop':
    case 'Sell_Stop_Limit':
      return 'SHORT';
    default:
      return marketSide;
  }
}

export function effectiveTradeDirection(
  form: Pick<ExecutionFormValue, 'order_type' | 'direction'>,
): TradeDirection {
  return tradeDirectionFromOrderType(form.order_type, form.direction);
}

export function isPlatformOrderType(value: unknown): value is PlatformOrderType {
  return (
    value === 'Market_Execution_Buy' ||
    value === 'Market_Execution_Sell' ||
    value === 'Buy_Limit' ||
    value === 'Sell_Limit' ||
    value === 'Buy_Stop' ||
    value === 'Sell_Stop' ||
    value === 'Buy_Stop_Limit' ||
    value === 'Sell_Stop_Limit'
  );
}

/** Migrate legacy `Market_Execution` + side into split dropdown values. */
export function normalizePlatformOrderType(
  orderType: unknown,
  direction: TradeDirection,
): PlatformOrderType {
  if (orderType === 'Market_Execution') {
    return direction === 'SHORT' ? 'Market_Execution_Sell' : 'Market_Execution_Buy';
  }

  if (isPlatformOrderType(orderType)) {
    return orderType;
  }

  return 'Market_Execution_Buy';
}
