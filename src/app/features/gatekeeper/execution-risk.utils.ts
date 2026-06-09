import { symbolRiskCalibration } from './execution-block.constants';
import type { ExecutionFormValue, ExecutionRiskMetrics } from './execution-block.types';
import { effectiveTradeDirection } from './execution-order.utils';
import type { AssetSymbol, TradeDirection } from '../../core/models/database.types';

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
  direction: TradeDirection,
): number {
  const raw = direction === 'LONG' ? entry - stop : stop - entry;
  return Math.max(0, raw);
}

export function computeRewardDistancePts(
  entry: number,
  target: number,
  direction: TradeDirection,
): number {
  const raw = direction === 'LONG' ? target - entry : entry - target;
  return Math.max(0, raw);
}

export function computeUsdFromPriceDistance(
  symbol: AssetSymbol,
  priceDistance: number,
  volume: number,
): { unitCount: number; perUnitUsd: number; totalUsd: number } {
  const cal = symbolRiskCalibration(symbol);
  const unitCount = priceDistance / cal.tickSize;
  const perUnitUsd = unitCount * cal.dollarPerTick;
  return {
    unitCount: roundTo(unitCount, 2),
    perUnitUsd: roundTo(perUnitUsd, 2),
    totalUsd: roundTo(perUnitUsd * volume, 2),
  };
}

export interface RiskRewardMetrics extends ExecutionRiskMetrics {
  rewardDistancePts: number;
  reward_unit_count: number;
  stop_unit_count: number;
  unit_label: string;
  reward_per_contract: number;
  total_reward: number;
  stop_valid: boolean;
  target_valid: boolean;
}

export function isStopPlacementValidForDirection(
  entry: number,
  stop: number,
  direction: TradeDirection,
): boolean {
  if (direction === 'LONG') {
    return stop < entry;
  }
  return stop > entry;
}

export function isTargetPlacementValidForDirection(
  entry: number,
  target: number,
  direction: TradeDirection,
): boolean {
  if (direction === 'LONG') {
    return target > entry;
  }
  return target < entry;
}

export function computeRiskRewardMetrics(input: {
  symbol: AssetSymbol;
  direction: TradeDirection;
  entry_price: number | null;
  stop_price: number | null;
  target_price: number | null;
  volume: number | null;
}): RiskRewardMetrics | null {
  const entry = input.entry_price;
  const stop = input.stop_price;
  const volume = input.volume ?? 0;

  if (entry == null || stop == null || volume <= 0) {
    return null;
  }

  const cal = symbolRiskCalibration(input.symbol);
  const stopDistancePts = computeStopDistancePts(entry, stop, input.direction);
  const stopRisk = computeUsdFromPriceDistance(input.symbol, stopDistancePts, 1);
  const totalRisk = computeUsdFromPriceDistance(input.symbol, stopDistancePts, volume);

  let rewardDistancePts = 0;
  let rewardUnitCount = 0;
  let rewardPerContract = 0;
  let totalReward = 0;
  let rTarget: number | null = null;
  const targetValid =
    input.target_price != null &&
    isTargetPlacementValidForDirection(entry, input.target_price, input.direction);

  if (targetValid && input.target_price != null) {
    rewardDistancePts = computeRewardDistancePts(entry, input.target_price, input.direction);
    const reward = computeUsdFromPriceDistance(input.symbol, rewardDistancePts, 1);
    rewardUnitCount = reward.unitCount;
    rewardPerContract = reward.perUnitUsd;
    totalReward = roundTo(reward.perUnitUsd * volume, 2);
    if (stopDistancePts > 0) {
      rTarget = roundTo(rewardDistancePts / stopDistancePts, 2);
    }
  }

  return {
    stopDistancePts: roundTo(stopDistancePts, cal.priceDecimals),
    stop_unit_count: stopRisk.unitCount,
    unit_label: cal.unitLabel,
    risk_per_contract: stopRisk.perUnitUsd,
    total_risk: totalRisk.totalUsd,
    rewardDistancePts: roundTo(rewardDistancePts, cal.priceDecimals),
    reward_unit_count: rewardUnitCount,
    reward_per_contract: rewardPerContract,
    total_reward: totalReward,
    r_target: rTarget,
    stop_valid: isStopPlacementValidForDirection(entry, stop, input.direction),
    target_valid: targetValid,
  };
}

export function computeRiskMetrics(
  form: Pick<
    ExecutionFormValue,
    'symbol' | 'order_type' | 'direction' | 'entry_price' | 'stop_price' | 'volume' | 'take_profit_price'
  >,
): ExecutionRiskMetrics {
  const metrics = computeRiskRewardMetrics({
    symbol: form.symbol,
    direction: effectiveTradeDirection(form),
    entry_price: form.entry_price,
    stop_price: form.stop_price,
    target_price: form.take_profit_price,
    volume: form.volume,
  });

  if (!metrics) {
    return {
      stopDistancePts: 0,
      risk_per_contract: 0,
      total_risk: 0,
      r_target: null,
    };
  }

  return {
    stopDistancePts: metrics.stopDistancePts,
    risk_per_contract: metrics.risk_per_contract,
    total_risk: metrics.total_risk,
    r_target: metrics.r_target,
  };
}

export function isStopPlacementValid(form: ExecutionFormValue): boolean {
  if (!form.entry_price || !form.stop_price) {
    return false;
  }
  return isStopPlacementValidForDirection(
    form.entry_price,
    form.stop_price,
    effectiveTradeDirection(form),
  );
}
