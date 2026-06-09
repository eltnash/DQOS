import type { AssetSymbol } from '../../core/models/database.types';

export interface SymbolRiskCalibration {
  /** Minimum price increment (1 tick / pip). */
  tickSize: number;
  /** Suggested decimal places for entry / stop / target inputs. */
  priceDecimals: number;
  /** USD P&L per tick move, per 1 contract or standard lot. */
  dollarPerTick: number;
  /** Display label for tick count (ticks, pips, etc.). */
  unitLabel: string;
}

/** Calibrated tick value table — aligned with CME / standard FX lot assumptions. */
export const SYMBOL_RISK_CALIBRATION: Record<AssetSymbol, SymbolRiskCalibration> = {
  ES: { tickSize: 0.25, priceDecimals: 2, dollarPerTick: 12.5, unitLabel: 'ticks' },
  NQ: { tickSize: 0.25, priceDecimals: 2, dollarPerTick: 5, unitLabel: 'ticks' },
  RTY: { tickSize: 0.1, priceDecimals: 2, dollarPerTick: 5, unitLabel: 'ticks' },
  YM: { tickSize: 1, priceDecimals: 0, dollarPerTick: 5, unitLabel: 'ticks' },
  CL: { tickSize: 0.01, priceDecimals: 2, dollarPerTick: 10, unitLabel: 'ticks' },
  GC: { tickSize: 0.1, priceDecimals: 2, dollarPerTick: 10, unitLabel: 'ticks' },
  SI: { tickSize: 0.005, priceDecimals: 3, dollarPerTick: 25, unitLabel: 'ticks' },
  ZB: { tickSize: 0.03125, priceDecimals: 5, dollarPerTick: 31.25, unitLabel: 'ticks' },
  EURUSD: { tickSize: 0.0001, priceDecimals: 5, dollarPerTick: 10, unitLabel: 'pips' },
  GBPUSD: { tickSize: 0.0001, priceDecimals: 5, dollarPerTick: 10, unitLabel: 'pips' },
  USDJPY: { tickSize: 0.01, priceDecimals: 3, dollarPerTick: 9, unitLabel: 'pips' },
  AUDUSD: { tickSize: 0.0001, priceDecimals: 5, dollarPerTick: 10, unitLabel: 'pips' },
  USDCAD: { tickSize: 0.0001, priceDecimals: 5, dollarPerTick: 10, unitLabel: 'pips' },
  USDCHF: { tickSize: 0.0001, priceDecimals: 5, dollarPerTick: 10, unitLabel: 'pips' },
  NZDUSD: { tickSize: 0.0001, priceDecimals: 5, dollarPerTick: 10, unitLabel: 'pips' },
  EURGBP: { tickSize: 0.0001, priceDecimals: 5, dollarPerTick: 10, unitLabel: 'pips' },
  EURJPY: { tickSize: 0.01, priceDecimals: 3, dollarPerTick: 9, unitLabel: 'pips' },
  GBPJPY: { tickSize: 0.01, priceDecimals: 3, dollarPerTick: 9, unitLabel: 'pips' },
  XAUUSD: { tickSize: 0.01, priceDecimals: 2, dollarPerTick: 1, unitLabel: 'pips' },
  XAGUSD: { tickSize: 0.001, priceDecimals: 3, dollarPerTick: 5, unitLabel: 'pips' },
};

/** @deprecated Use SYMBOL_RISK_CALIBRATION — kept for legacy references. */
export const POINT_VALUE_USD: Record<AssetSymbol, number> = Object.fromEntries(
  Object.entries(SYMBOL_RISK_CALIBRATION).map(([symbol, cal]) => [
    symbol,
    cal.dollarPerTick / cal.tickSize,
  ]),
) as Record<AssetSymbol, number>;

export function symbolRiskCalibration(symbol: AssetSymbol): SymbolRiskCalibration {
  return SYMBOL_RISK_CALIBRATION[symbol];
}
