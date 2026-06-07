import type { AssetSymbol } from '../../core/models/database.types';

/** Approximate $ risk per 1.0 price unit move (1 contract / standard lot). FX values are indicative. */
export const POINT_VALUE_USD: Record<AssetSymbol, number> = {
  ES: 50,
  NQ: 20,
  RTY: 50,
  YM: 5,
  CL: 1000,
  GC: 100,
  SI: 5000,
  ZB: 1000,
  EURUSD: 10,
  GBPUSD: 10,
  USDJPY: 9,
  AUDUSD: 10,
  USDCAD: 10,
  USDCHF: 10,
  NZDUSD: 10,
  EURGBP: 10,
  EURJPY: 9,
  GBPJPY: 9,
  XAUUSD: 100,
  XAGUSD: 50,
};
