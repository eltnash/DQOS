import type {
  AnalysisPeriod,
  AnalyzedTimeframe,
  AssetSymbol,
  AuctionLocation,
  CompositeValuePosition,
  ConfirmationTrigger,
  DayType,
  HtfAnalysisTool,
  HtfAuctionRegime,
  MarketBehavior,
  MarketSession,
  MarketStructureBias,
  PillarFocusTimeframe,
  PriorWeekRangePosition,
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
  { label: 'Session VWAP', value: 'Session_VWAP', hint: 'Current session volume-weighted average price' },
  { label: 'Anchored VWAP', value: 'Anchored_VWAP', hint: 'VWAP anchored to a structural event or session open' },
  { label: 'Composite VAH', value: 'Composite_VAH', hint: 'Composite profile upper edge' },
  { label: 'Composite VAL', value: 'Composite_VAL', hint: 'Composite profile lower edge' },
  { label: 'Composite POC', value: 'Composite_POC', hint: 'Composite point of control' },
  { label: 'Overnight High', value: 'Overnight_High', hint: 'Session boundary — stress zone' },
  { label: 'Overnight Low', value: 'Overnight_Low', hint: 'Session boundary — stress zone' },
  { label: 'Prior Day High', value: 'Prior_Day_High', hint: 'Previous RTH high — reference for continuation or failure' },
  { label: 'Prior Day Low', value: 'Prior_Day_Low', hint: 'Previous RTH low — reference for continuation or failure' },
  { label: 'Single Print', value: 'Single_Print', hint: 'Low-volume node — fast migration unless accepted' },
  { label: 'Naked POC', value: 'Naked_POC', hint: 'Untested POC — magnet / decision level' },
  { label: 'Order Block', value: 'Order_Block', hint: 'Institutional footprint — last opposing candle before displacement' },
  { label: 'Fair Value Gap', value: 'Fair_Value_Gap', hint: 'Imbalance zone — price may retrace to rebalance' },
  { label: 'HVN', value: 'HVN', hint: 'High volume node — accepted business, potential rotation' },
  { label: 'LVN', value: 'LVN', hint: 'Low volume node — thin liquidity, fast migration' },
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

export const FUTURES_SYMBOL_OPTIONS: SelectOption<AssetSymbol>[] = [
  { label: 'ES (S&P)', value: 'ES' },
  { label: 'NQ (Nasdaq)', value: 'NQ' },
  { label: 'RTY (Russell)', value: 'RTY' },
  { label: 'YM (Dow)', value: 'YM' },
  { label: 'CL (Crude)', value: 'CL' },
  { label: 'GC (Gold futures)', value: 'GC' },
  { label: 'SI (Silver futures)', value: 'SI' },
  { label: 'ZB (Bonds)', value: 'ZB' },
];

export const FX_SYMBOL_OPTIONS: SelectOption<AssetSymbol>[] = [
  { label: 'EUR/USD', value: 'EURUSD' },
  { label: 'GBP/USD', value: 'GBPUSD' },
  { label: 'USD/JPY', value: 'USDJPY' },
  { label: 'AUD/USD', value: 'AUDUSD' },
  { label: 'USD/CAD', value: 'USDCAD' },
  { label: 'USD/CHF', value: 'USDCHF' },
  { label: 'NZD/USD', value: 'NZDUSD' },
  { label: 'EUR/GBP', value: 'EURGBP' },
  { label: 'EUR/JPY', value: 'EURJPY' },
  { label: 'GBP/JPY', value: 'GBPJPY' },
];

export const COMMODITY_SYMBOL_OPTIONS: SelectOption<AssetSymbol>[] = [
  { label: 'Gold (XAU/USD)', value: 'XAUUSD' },
  { label: 'Silver (XAG/USD)', value: 'XAGUSD' },
];

/** @deprecated Use grouped options in session bar; kept for execution fallbacks. */
export const ASSET_SYMBOL_OPTIONS: SelectOption<AssetSymbol>[] = [
  ...FUTURES_SYMBOL_OPTIONS,
  ...FX_SYMBOL_OPTIONS,
  ...COMMODITY_SYMBOL_OPTIONS,
];

export const MARKET_SESSION_OPTIONS: SelectOption<MarketSession>[] = [
  { label: 'Asia', value: 'Asia', hint: 'Tokyo / Sydney session overlap' },
  { label: 'London', value: 'London', hint: 'European session — key liquidity window' },
  { label: 'New York', value: 'New_York', hint: 'US session — highest participation for many instruments' },
];

export const ANALYSIS_PERIOD_OPTIONS: SelectOption<AnalysisPeriod>[] = [
  { label: 'Morning', value: 'Morning', hint: 'Pre-market / early session analysis' },
  { label: 'Afternoon', value: 'Afternoon', hint: 'Mid-session rotation or continuation reads' },
  { label: 'Night', value: 'Night', hint: 'Late session or overnight planning' },
];

export const TIMEZONE_OPTIONS: SelectOption<string>[] = [
  { label: 'Auto (browser)', value: 'AUTO' },
  { label: 'New York (ET)', value: 'America/New_York' },
  { label: 'Chicago (CT)', value: 'America/Chicago' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'Johannesburg (SAST)', value: 'Africa/Johannesburg' },
  { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'Sydney (AEST)', value: 'Australia/Sydney' },
  { label: 'UTC', value: 'UTC' },
];

export const TRADE_DIRECTION_OPTIONS: SelectOption<TradeDirection>[] = [
  { label: 'Long', value: 'LONG' },
  { label: 'Short', value: 'SHORT' },
];

export const DAY_TYPE_OPTIONS: SelectOption<DayType>[] = [
  {
    label: 'D-Shape (Balance)',
    value: 'D_Day',
    hint: 'Two-sided auction rotating around a center — normal, neutral, or non-trend character',
  },
  {
    label: 'P-Shape (Upper Heavy)',
    value: 'P_Day',
    hint: 'Volume concentrated in the upper part of the range with a thin lower tail — describes where acceptance built, not trend direction',
  },
  {
    label: 'b-Shape (Lower Heavy)',
    value: 'b_Day',
    hint: 'Volume concentrated in the lower part of the range with a thin upper tail — describes where acceptance built, not trend direction',
  },
  {
    label: 'Trend / Elongated',
    value: 'Trend_Day',
    hint: 'Directional discovery — value migrating with the drive; join pullbacks',
  },
  {
    label: 'Double Distribution',
    value: 'Double_Dist',
    hint: 'Two value zones with a low-volume corridor — trend or breakout continuation setups',
  },
];

export interface CheckboxOption<T extends string = string> {
  label: string;
  key: T;
  hint?: string;
}

export const ANALYZED_TIMEFRAME_KEYS = ['M', 'W', 'D', 'H4', 'H1'] as const satisfies readonly AnalyzedTimeframe[];

export const ANALYZED_TIMEFRAME_OPTIONS: CheckboxOption<AnalyzedTimeframe>[] = [
  { key: 'M', label: 'Monthly', hint: 'Macro value migration & major balance' },
  {
    key: 'W',
    label: 'Weekly',
    hint: 'Prior week high/low and prior week composite vs the developing week only',
  },
  { key: 'D', label: 'Daily', hint: 'Developing day type & session value' },
  { key: 'H4', label: '4 Hour', hint: 'Intermediate structure & rotations' },
  { key: 'H1', label: '1 Hour', hint: 'Intraday structure into 15m execution' },
];

export const PILLAR_FOCUS_TIMEFRAME_OPTIONS: SelectOption<PillarFocusTimeframe>[] = [
  { label: '15 minute', value: 'M15', hint: 'Primary execution timeframe' },
  { label: '5 minute', value: 'M5', hint: 'Finer entry structure & retest detail' },
  { label: '1 minute', value: 'M1', hint: 'Micro confirmation & order flow' },
];

export const COMPOSITE_VALUE_POSITION_OPTIONS: SelectOption<CompositeValuePosition>[] = [
  {
    label: 'Above composite VA',
    value: 'Above_VA',
    hint: 'Price accepted above multi-day value — look for continuation or repair back to value',
  },
  {
    label: 'Below composite VA',
    value: 'Below_VA',
    hint: 'Price accepted below multi-day value — sellers or responsive buyers in control',
  },
  {
    label: 'Inside composite VA',
    value: 'Inside_VA',
    hint: 'Rotational balance — extremes may be faded until migration',
  },
];

export const HTF_AUCTION_REGIME_OPTIONS: SelectOption<HtfAuctionRegime>[] = [
  {
    label: 'Breaking balance',
    value: 'Breaking_Balance',
    hint: 'Auction leaving a multi-day balance — initiative moves toward new value',
  },
  {
    label: 'Rotating in balance',
    value: 'Rotating_Balance',
    hint: 'Two-sided trade inside a larger value area — fade extremes, wait for migration',
  },
  {
    label: 'Repairing structure',
    value: 'Repairing_Structure',
    hint: 'Poor highs/lows, single prints, LVNs — market attempting to finish unfinished business',
  },
  {
    label: 'Migrating to composite POC',
    value: 'Migrating_To_Composite_POC',
    hint: 'Directional trend through LVN or low-volume — price gravitating back toward the composite point of control or major HVN magnet',
  },
];

export const MARKET_STRUCTURE_BIAS_OPTIONS: SelectOption<MarketStructureBias>[] = [
  {
    label: 'Bullish (HH / HL)',
    value: 'Bullish_HH_HL',
    hint: 'Buyers in control — higher highs and higher lows on reviewed timeframes',
  },
  {
    label: 'Bearish (LH / LL)',
    value: 'Bearish_LH_LL',
    hint: 'Sellers in control — lower highs and lower lows on reviewed timeframes',
  },
  {
    label: 'Balance / range',
    value: 'Balance_Range',
    hint: 'Overlapping value — no clear directional control, responsive trade environment',
  },
  {
    label: 'Transitional (BOS)',
    value: 'Transitional_BOS',
    hint: 'Break of structure — control shifting; watch for acceptance at new levels',
  },
];

export const HTF_ANALYSIS_TOOL_OPTIONS: CheckboxOption<HtfAnalysisTool>[] = [
  { key: 'Composite_VP', label: 'Composite volume profile' },
  { key: 'Multi_Day_VAH_VAL_POC', label: 'Multi-day VAH / VAL / POC' },
  { key: 'Major_HVN_LVN', label: 'Major HVNs & LVNs' },
  { key: 'Multi_Day_TPO', label: 'Multi-day TPO' },
  { key: 'Value_Area_Migration', label: 'Value area migration' },
  { key: 'Day_Type_Series', label: 'Day type series (trend vs balance)' },
  { key: 'Unfinished_Business', label: 'Unfinished business (poor highs/lows, single prints)' },
  {
    key: 'Market_Structure_Trendlines',
    label: 'Market structure trend lines (HH/HL, LH/LL)',
    hint: 'Diagonal structure lines showing swing progression and control',
  },
  {
    key: 'Prior_Week_HL_Lines',
    label: 'Prior week high / low lines',
    hint: 'Vertical or horizontal markers for last week\'s range — inside, above, or below on the open',
  },
];

export const PRIOR_WEEK_RANGE_OPTIONS: SelectOption<PriorWeekRangePosition>[] = [
  {
    label: 'Inside prior week',
    value: 'Inside_Prior_Week',
    hint: 'Current week trading within prior week high/low — rotational / responsive environment',
  },
  {
    label: 'Above prior week high',
    value: 'Breaking_Prior_Week_High',
    hint: 'Current week trading above prior week high — initiative higher, watch acceptance',
  },
  {
    label: 'Below prior week low',
    value: 'Breaking_Prior_Week_Low',
    hint: 'Current week trading below prior week low — initiative lower, watch acceptance',
  },
];
