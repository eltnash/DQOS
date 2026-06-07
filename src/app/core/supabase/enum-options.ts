import type {
  AssetSymbol,
  AuctionLocation,
  ConfirmationTrigger,
  DayType,
  MarketBehavior,
  TradeDirection,
} from '../models/database.types';

export interface SelectOption<T extends string = string> {
  label: string;
  value: T;
  hint?: string;
}

export const AUCTION_LOCATION_OPTIONS: SelectOption<AuctionLocation>[] = [
  { label: 'VAH', value: 'VAH', hint: 'Value area high — upper boundary of accepted value' },
  { label: 'VAL', value: 'VAL', hint: 'Value area low — lower boundary of accepted value' },
  { label: 'POC', value: 'POC', hint: 'Point of control — greatest participation' },
  { label: 'Weekly VWAP', value: 'Weekly_VWAP', hint: 'Multi-day value reference' },
  { label: 'Monthly VWAP', value: 'Monthly_VWAP', hint: 'Higher-timeframe value reference' },
  { label: 'Composite VAH', value: 'Composite_VAH', hint: 'Composite profile upper edge' },
  { label: 'Composite VAL', value: 'Composite_VAL', hint: 'Composite profile lower edge' },
  { label: 'Composite POC', value: 'Composite_POC', hint: 'Composite point of control' },
  { label: 'Overnight High', value: 'Overnight_High', hint: 'Session boundary — stress zone' },
  { label: 'Overnight Low', value: 'Overnight_Low', hint: 'Session boundary — stress zone' },
  { label: 'Single Print', value: 'Single_Print', hint: 'Low-volume node — fast migration unless accepted' },
  { label: 'Naked POC', value: 'Naked_POC', hint: 'Untested POC — magnet / decision level' },
];

export const MARKET_BEHAVIOR_OPTIONS: SelectOption<MarketBehavior>[] = [
  {
    label: 'Rejection',
    value: 'Rejection',
    hint: 'Price fails to sustain business — rapid return toward prior value',
  },
  {
    label: 'Acceptance',
    value: 'Acceptance',
    hint: 'Time + volume building — market agrees to do business here',
  },
  {
    label: 'Rotation',
    value: 'Rotation',
    hint: 'Two-sided trade holding inside a developing range',
  },
  { label: 'Exhaustion', value: 'Exhaustion', hint: 'Late-stage move losing participation' },
  { label: 'Excess', value: 'Excess', hint: 'Overextension beyond fair value' },
  { label: 'Failed Auction', value: 'Failed_Auction', hint: 'Breakout attempt that cannot hold' },
  {
    label: 'Value Migration',
    value: 'Value_Migration',
    hint: 'Market leaving one value area and establishing new value',
  },
  { label: 'Responsive Buying', value: 'Responsive_Buying', hint: 'Buyers defending lower prices' },
  { label: 'Responsive Selling', value: 'Responsive_Selling', hint: 'Sellers defending higher prices' },
];

export const CONFIRMATION_TRIGGER_OPTIONS: SelectOption<ConfirmationTrigger>[] = [
  { label: 'Delta Divergence', value: 'Delta_Divergence', hint: 'CVD diverging from price at the edge' },
  { label: 'Volume Absorption', value: 'Volume_Absorption', hint: 'High volume without progress' },
  { label: 'Excess Tail', value: 'Excess_Tail', hint: 'Profile tail showing rejection or acceptance' },
  { label: 'VWAP Reclaim', value: 'VWAP_Reclaim', hint: 'Session VWAP reclaimed with intent' },
  { label: 'Market Structure Break', value: 'Market_Structure_Break', hint: 'Structural shift confirming control' },
];

export const ASSET_SYMBOL_OPTIONS: SelectOption<AssetSymbol>[] = [
  { label: 'ES', value: 'ES' },
  { label: 'NQ', value: 'NQ' },
  { label: 'RTY', value: 'RTY' },
  { label: 'YM', value: 'YM' },
  { label: 'CL', value: 'CL' },
  { label: 'GC', value: 'GC' },
  { label: 'SI', value: 'SI' },
  { label: 'ZB', value: 'ZB' },
];

export const TRADE_DIRECTION_OPTIONS: SelectOption<TradeDirection>[] = [
  { label: 'Long', value: 'LONG' },
  { label: 'Short', value: 'SHORT' },
];

export const DAY_TYPE_OPTIONS: SelectOption<DayType>[] = [
  { label: 'D-Day (Balanced)', value: 'D_Day' },
  { label: 'P-Day (Trend)', value: 'P_Day' },
  { label: 'b-Day (Double distribution)', value: 'b_Day' },
  { label: 'Trend Day', value: 'Trend_Day' },
  { label: 'Double Distribution', value: 'Double_Dist' },
];
