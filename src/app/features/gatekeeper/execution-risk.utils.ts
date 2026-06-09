import { POINT_VALUE_USD } from './execution-block.constants';
import type { ExecutionFormValue, ExecutionRiskMetrics } from './execution-block.types';
import { effectiveTradeDirection } from './execution-order.utils';

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function computeStopDistancePts(
  entry: number,
  stop: number,
  direction: 'LONG' | 'SHORT',
): number {
  const raw = direction === 'LONG' ? entry - stop : stop - entry;
  return Math.max(0, raw);
}

export function computeRiskMetrics(
  form: Pick<
    ExecutionFormValue,
    'symbol' | 'order_type' | 'direction' | 'entry_price' | 'stop_price' | 'volume' | 'take_profit_price'
  >,
): ExecutionRiskMetrics {
  const entry = form.entry_price ?? 0;
  const stop = form.stop_price ?? 0;
  const volume = form.volume ?? 0;
  const direction = effectiveTradeDirection(form);

  const stopDistancePts = computeStopDistancePts(entry, stop, direction);

  const pointValue = POINT_VALUE_USD[form.symbol];
  const risk_per_contract = stopDistancePts * pointValue;
  const total_risk = risk_per_contract * volume;

  let r_target: number | null = null;
  if (form.take_profit_price != null && stopDistancePts > 0) {
    const rewardPts =
      direction === 'LONG'
        ? form.take_profit_price - entry
        : entry - form.take_profit_price;
    if (rewardPts > 0) {
      r_target = roundTo(rewardPts / stopDistancePts, 2);
    }
  }

  return {
    stopDistancePts: roundTo(stopDistancePts, 4),
    risk_per_contract: roundTo(risk_per_contract, 2),
    total_risk: roundTo(total_risk, 2),
    r_target,
  };
}

export function isStopPlacementValid(form: ExecutionFormValue): boolean {
  if (!form.entry_price || !form.stop_price) {
    return false;
  }
  const direction = effectiveTradeDirection(form);
  if (direction === 'LONG') {
    return form.stop_price < form.entry_price;
  }
  return form.stop_price > form.entry_price;
}
