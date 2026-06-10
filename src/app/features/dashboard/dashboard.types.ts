import type {
  AuctionLocation,
  AuctionStrategy,
  ConfirmationTrigger,
  DayType,
  MarketBehavior,
  PillarJournalsSnapshot,
  TradeDirection,
} from '../../core/models/database.types';

/** < 30 trades */
export type ConfidenceLevel = 'insufficient' | 'preliminary' | 'probable' | 'robust';

export type EdgeStatus = 'insufficient_data' | 'no_edge' | 'possible_edge' | 'positive_edge' | 'confirmed_edge';

export type StrategyHealthStatus = 'growing_edge' | 'stable_edge' | 'deteriorating_edge' | 'no_edge';

export type ProcessGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface RawTradeRow {
  id: string;
  auction_strategy: AuctionStrategy | null;
  day_type: DayType | null;
  trading_date: string;
  net_profit: number | null;
  r_multiple: number | null;
  closed_at: string | null;
  symbol: string;
  direction: TradeDirection;
  entry_price: number | null;
  stop_price: number | null;
  exit_price: number | null;
  size: number | null;
  process_compliance_pct: number | null;
  location: AuctionLocation | null;
  behavior: MarketBehavior | null;
  confirmation: ConfirmationTrigger | null;
  invalidation_level: string | null;
  invalidation_price: number | null;
}

export interface EnrichedTradeRow {
  id: string;
  auction_strategy: AuctionStrategy | null;
  day_type: DayType | null;
  trading_date: string;
  net_profit: number | null;
  r_multiple: number | null;
  computed_r: number | null;
  closed_at: string | null;
  symbol: string;
  direction: TradeDirection;
  entry_price: number | null;
  stop_price: number | null;
  exit_price: number | null;
  size: number | null;
  process_compliance_pct: number | null;
  location: AuctionLocation | null;
  behavior: MarketBehavior | null;
  confirmation: ConfirmationTrigger | null;
  invalidation_level: string | null;
  invalidation_price: number | null;
  process_score: number;
  process_grade: ProcessGrade;
}

export interface EdgeAssessment {
  edgeStatus: EdgeStatus;
  confidenceLevel: ConfidenceLevel;
  sampleSize: number;
  tradesUntilMinimum: number;
  expectancyR: number | null;
  expectancyDollars: number;
  profitFactor: number | null;
  avgR: number | null;
  winRate: number;
  maxDrawdownDollars: number;
  maxDrawdownPct: number;
  sqn: number | null;
  recoveryFactor: number | null;
  sharpeRatio: number | null;
  riskOfRuin: number | null;
  totalPnl: number;
  isProfitable: boolean;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface RollingMetricPoint {
  tradeIndex: number;
  date: string;
  value: number;
}

export interface SetupAnalyticsRow {
  dimension: 'location' | 'behavior' | 'confirmation' | 'strategy' | 'day_type';
  key: string;
  label: string;
  tradeCount: number;
  winRate: number;
  expectancyR: number | null;
  expectancyDollars: number;
  profitFactor: number | null;
  avgR: number | null;
  confidenceLevel: ConfidenceLevel;
  edgeStatus: EdgeStatus;
}

export interface EdgePatternRow {
  location: string;
  locationLabel: string;
  behavior: string;
  behaviorLabel: string;
  confirmation: string;
  confirmationLabel: string;
  tradeCount: number;
  winRate: number;
  expectancyR: number | null;
  profitFactor: number | null;
  confidenceLevel: ConfidenceLevel;
}

export interface ProcessGradeStats {
  grade: ProcessGrade;
  score: number;
  tradeCount: number;
  winRate: number;
  expectancyR: number | null;
  expectancyDollars: number;
}

export interface RiskAnalytics {
  maxDrawdownDollars: number;
  maxDrawdownPct: number;
  currentDrawdownDollars: number;
  currentDrawdownPct: number;
  largestWin: number;
  largestLoss: number;
  avgRiskPerTrade: number | null;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  currentStreakType: 'win' | 'loss' | 'flat' | 'none';
  currentStreakCount: number;
}

export interface StrategyHealth {
  status: StrategyHealthStatus;
  summary: string;
  rollingExpectancyR: number | null;
  historicalExpectancyR: number | null;
  rollingProfitFactor: number | null;
  historicalProfitFactor: number | null;
  recentWinRate: number | null;
  historicalWinRate: number | null;
}

export interface DayTradeSummary {
  date: string;
  tradeCount: number;
  netPnl: number;
  winCount: number;
  lossCount: number;
}

export interface OutcomeGalleryItem {
  tradeId: string;
  strategy: AuctionStrategy | null;
  tradingDate: string;
  netProfit: number;
  symbol: string;
  imageUrl: string;
  fileName: string;
}

/** All analytics for one auction strategy — never mixed with the other. */
export interface StrategyAnalyticsBundle {
  strategy: AuctionStrategy;
  label: string;
  edgeAssessment: EdgeAssessment;
  strategyHealth: StrategyHealth;
  strategyPnlCurve: SeriesPoint[];
  cumulativeRCurve: SeriesPoint[];
  monthlyPerformance: SeriesPoint[];
  rollingExpectancy: RollingMetricPoint[];
  rollingProfitFactor: RollingMetricPoint[];
  rollingWinRate: RollingMetricPoint[];
  setupAnalytics: SetupAnalyticsRow[];
  edgePatterns: EdgePatternRow[];
  processGrades: ProcessGradeStats[];
  avgProcessScore: number;
  riskAnalytics: RiskAnalytics;
}

export interface ProfessionalDashboardSnapshot {
  trades: EnrichedTradeRow[];
  /** One isolated analytics bundle per auction strategy. */
  strategyBundles: StrategyAnalyticsBundle[];
  /** Account-level only — combined balance across all strategies. */
  accountEquityCurve: SeriesPoint[];
  daySummaries: Map<string, DayTradeSummary>;
  outcomeGallery: OutcomeGalleryItem[];
}

export interface ExecutionAuditRow {
  trade_id: string;
  location: AuctionLocation | null;
  behavior: MarketBehavior | null;
  confirmation: ConfirmationTrigger | null;
  invalidation_level: string | null;
  invalidation_price: number | null;
  pillar_journals: PillarJournalsSnapshot | null;
}
