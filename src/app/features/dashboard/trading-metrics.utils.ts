import {
  computeRiskRewardMetrics,
  computeStopDistancePts,
} from '../gatekeeper/execution-risk.utils';
import {
  behaviorLabel,
  confirmationLabel,
  dayTypeLabel,
  locationLabel,
  strategyLabel,
} from './dashboard-labels.utils';
import type {
  ConfidenceLevel,
  EdgeAssessment,
  EdgePatternRow,
  EdgeStatus,
  EnrichedTradeRow,
  ExecutionAuditRow,
  ProcessGrade,
  ProcessGradeStats,
  RawTradeRow,
  RiskAnalytics,
  RollingMetricPoint,
  SeriesPoint,
  SetupAnalyticsRow,
  StrategyAnalyticsBundle,
  StrategyHealth,
  StrategyHealthStatus,
} from './dashboard.types';
import type {
  AssetSymbol,
  AuctionLocation,
  AuctionStrategy,
  ConfirmationTrigger,
  DayType,
  MarketBehavior,
  TradeDirection,
} from '../../core/models/database.types';

export const SAMPLE_MINIMUM = 30;
export const SAMPLE_PRELIMINARY = 100;
export const SAMPLE_ROBUST = 300;
const ROLLING_WINDOW = 30;
const MIN_PATTERN_TRADES = 5;

export const ALL_AUCTION_STRATEGIES: AuctionStrategy[] = ['Level_Rejection', 'Level_Acceptance'];

export function confidenceLevelForCount(count: number): ConfidenceLevel {
  if (count < SAMPLE_MINIMUM) return 'insufficient';
  if (count < SAMPLE_PRELIMINARY) return 'preliminary';
  if (count < SAMPLE_ROBUST) return 'probable';
  return 'robust';
}

export function confidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'insufficient':
      return 'Insufficient Data';
    case 'preliminary':
      return 'Preliminary Evidence';
    case 'probable':
      return 'Probable Edge';
    case 'robust':
      return 'Statistically Robust';
  }
}

export function edgeStatusLabel(status: EdgeStatus): string {
  switch (status) {
    case 'insufficient_data':
      return 'Insufficient Data';
    case 'no_edge':
      return 'No Edge';
    case 'possible_edge':
      return 'Possible Edge';
    case 'positive_edge':
      return 'Positive Edge';
    case 'confirmed_edge':
      return 'Confirmed Edge';
  }
}

export function healthStatusLabel(status: StrategyHealthStatus): string {
  switch (status) {
    case 'growing_edge':
      return 'Growing Edge';
    case 'stable_edge':
      return 'Stable Edge';
    case 'deteriorating_edge':
      return 'Deteriorating Edge';
    case 'no_edge':
      return 'No Edge Detected';
  }
}

export function computeTradeR(trade: {
  r_multiple: number | null;
  entry_price: number | null;
  stop_price: number | null;
  exit_price: number | null;
  direction: TradeDirection;
  net_profit: number | null;
  symbol: string;
  size: number | null;
}): number | null {
  if (trade.r_multiple != null && Number.isFinite(trade.r_multiple)) {
    return trade.r_multiple;
  }

  const { entry_price, stop_price, exit_price, direction } = trade;
  if (entry_price != null && stop_price != null && exit_price != null) {
    const riskPts = computeStopDistancePts(entry_price, stop_price, direction);
    if (riskPts > 0) {
      const rewardPts =
        direction === 'LONG' ? exit_price - entry_price : entry_price - exit_price;
      return rewardPts / riskPts;
    }
  }

  if (
    trade.net_profit != null &&
    entry_price != null &&
    stop_price != null &&
    trade.size != null &&
    trade.size > 0
  ) {
    const risk = computeRiskRewardMetrics({
      symbol: trade.symbol as AssetSymbol,
      direction,
      entry_price,
      stop_price,
      target_price: null,
      volume: trade.size,
    });
    if (risk && risk.total_risk > 0) {
      return trade.net_profit / risk.total_risk;
    }
  }

  return null;
}

export function processScoreFromAudit(audit: ExecutionAuditRow | undefined): number {
  if (!audit) return 0;
  let score = 0;
  if (audit.location) score += 1;
  if (audit.behavior) score += 1;
  if (audit.confirmation) score += 1;
  if (audit.invalidation_price != null || (audit.invalidation_level?.trim().length ?? 0) > 0) {
    score += 1;
  }
  return score;
}

export function gradeFromScore(score: number): ProcessGrade {
  if (score >= 4) return 'A';
  if (score === 3) return 'B';
  if (score === 2) return 'C';
  if (score === 1) return 'D';
  return 'F';
}

export function enrichTrades(
  trades: RawTradeRow[],
  audits: Map<string, ExecutionAuditRow>,
): EnrichedTradeRow[] {
  return trades.map((trade) => {
    const audit = audits.get(trade.id);
    const process_score = processScoreFromAudit(audit);
    return {
      ...trade,
      location: audit?.location ?? trade.location,
      behavior: audit?.behavior ?? trade.behavior,
      confirmation: audit?.confirmation ?? trade.confirmation,
      invalidation_level: audit?.invalidation_level ?? trade.invalidation_level,
      invalidation_price: audit?.invalidation_price ?? trade.invalidation_price,
      computed_r: computeTradeR(trade),
      process_score,
      process_grade: gradeFromScore(process_score),
    };
  });
}

function sortedTrades(trades: EnrichedTradeRow[]): EnrichedTradeRow[] {
  return [...trades].sort((a, b) =>
    (a.closed_at ?? a.trading_date).localeCompare(b.closed_at ?? b.trading_date),
  );
}

function rValues(trades: EnrichedTradeRow[]): number[] {
  return trades.map((t) => t.computed_r).filter((r): r is number => r != null && Number.isFinite(r));
}

function winRate(trades: EnrichedTradeRow[]): number {
  if (trades.length === 0) return 0;
  return trades.filter((t) => Number(t.net_profit ?? 0) > 0).length / trades.length;
}

function profitFactor(trades: EnrichedTradeRow[]): number | null {
  const pnls = trades.map((t) => Number(t.net_profit ?? 0));
  const grossProfit = pnls.filter((p) => p > 0).reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((s, p) => s + p, 0));
  if (grossLoss === 0) return grossProfit > 0 ? null : 0;
  return grossProfit / grossLoss;
}

function expectancyDollars(trades: EnrichedTradeRow[]): number {
  if (trades.length === 0) return 0;
  const total = trades.reduce((s, t) => s + Number(t.net_profit ?? 0), 0);
  return total / trades.length;
}

function expectancyR(trades: EnrichedTradeRow[]): number | null {
  const rs = rValues(trades);
  if (rs.length === 0) return null;
  return rs.reduce((s, r) => s + r, 0) / rs.length;
}

function avgR(trades: EnrichedTradeRow[]): number | null {
  return expectancyR(trades);
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function sqn(trades: EnrichedTradeRow[]): number | null {
  const rs = rValues(trades);
  if (rs.length < 2) return null;
  const avg = rs.reduce((s, r) => s + r, 0) / rs.length;
  const sd = stdDev(rs);
  if (!sd || sd === 0) return null;
  return (Math.sqrt(rs.length) * avg) / sd;
}

function sharpePerTrade(trades: EnrichedTradeRow[]): number | null {
  const rs = rValues(trades);
  if (rs.length < 2) return null;
  const avg = rs.reduce((s, r) => s + r, 0) / rs.length;
  const sd = stdDev(rs);
  if (!sd || sd === 0) return null;
  return avg / sd;
}

function riskOfRuinApprox(trades: EnrichedTradeRow[]): number | null {
  const wins = trades.filter((t) => Number(t.net_profit ?? 0) > 0);
  const losses = trades.filter((t) => Number(t.net_profit ?? 0) < 0);
  if (trades.length < SAMPLE_MINIMUM || wins.length === 0 || losses.length === 0) return null;

  const p = wins.length / trades.length;
  const avgWin = wins.reduce((s, t) => s + Math.abs(Number(t.net_profit ?? 0)), 0) / wins.length;
  const avgLoss =
    losses.reduce((s, t) => s + Math.abs(Number(t.net_profit ?? 0)), 0) / losses.length;
  if (avgLoss === 0) return null;

  const payoff = avgWin / avgLoss;
  const q = 1 - p;
  if (payoff <= 1) {
    return p < 0.5 ? 1 : Math.pow(q / p, 10);
  }
  const ratio = q / p;
  const exponent = 10 / payoff;
  return Math.min(1, Math.pow(ratio, exponent));
}

function drawdownSeries(
  trades: EnrichedTradeRow[],
  startingCapital: number,
): { equity: SeriesPoint[]; maxDd: number; maxDdPct: number; currentDd: number; currentDdPct: number } {
  const sorted = sortedTrades(trades);
  let balance = startingCapital;
  let peak = startingCapital;
  let maxDd = 0;
  let maxDdPct = 0;

  const equity: SeriesPoint[] = [];
  const byDate = new Map<string, number>();
  for (const t of sorted) {
    byDate.set(t.trading_date, (byDate.get(t.trading_date) ?? 0) + Number(t.net_profit ?? 0));
  }

  for (const [date, pnl] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    balance += pnl;
    peak = Math.max(peak, balance);
    const dd = peak - balance;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    maxDd = Math.max(maxDd, dd);
    maxDdPct = Math.max(maxDdPct, ddPct);
    equity.push({ date, value: balance });
  }

  const currentDd = peak - balance;
  const currentDdPct = peak > 0 ? (currentDd / peak) * 100 : 0;
  return { equity, maxDd, maxDdPct, currentDd, currentDdPct };
}

export function determineEdgeStatus(
  count: number,
  expR: number | null,
  expDollars: number,
  pf: number | null,
  maxDdPct: number,
): EdgeStatus {
  if (count < SAMPLE_MINIMUM) return 'insufficient_data';

  const effectivePf = pf ?? (expDollars > 0 ? Number.POSITIVE_INFINITY : 0);
  const effectiveExp = expR ?? (expDollars > 0 ? 0.01 : expDollars <= 0 ? -0.01 : 0);

  if (effectiveExp <= 0 || effectivePf < 1) return 'no_edge';
  if (maxDdPct > 30) return 'possible_edge';

  if (count >= SAMPLE_ROBUST && effectivePf >= 1.5 && effectiveExp > 0.2) {
    return 'confirmed_edge';
  }
  if (count >= SAMPLE_PRELIMINARY && effectivePf >= 1.3 && effectiveExp > 0) {
    return 'positive_edge';
  }
  return 'possible_edge';
}

export function computeEdgeAssessment(
  trades: EnrichedTradeRow[],
  startingCapital: number,
): EdgeAssessment {
  const count = trades.length;
  const expDollars = expectancyDollars(trades);
  const expR = expectancyR(trades);
  const pf = profitFactor(trades);
  const { maxDd, maxDdPct } = drawdownSeries(trades, startingCapital);
  const totalPnl = trades.reduce((s, t) => s + Number(t.net_profit ?? 0), 0);
  const recovery =
    maxDd > 0 && totalPnl > 0 ? totalPnl / maxDd : totalPnl <= 0 ? 0 : null;

  return {
    edgeStatus: determineEdgeStatus(count, expR, expDollars, pf, maxDdPct),
    confidenceLevel: confidenceLevelForCount(count),
    sampleSize: count,
    tradesUntilMinimum: Math.max(0, SAMPLE_MINIMUM - count),
    expectancyR: expR,
    expectancyDollars: expDollars,
    profitFactor: pf,
    avgR: avgR(trades),
    winRate: winRate(trades),
    maxDrawdownDollars: maxDd,
    maxDrawdownPct: maxDdPct,
    sqn: sqn(trades),
    recoveryFactor: recovery,
    sharpeRatio: sharpePerTrade(trades),
    riskOfRuin: riskOfRuinApprox(trades),
    totalPnl,
    isProfitable: totalPnl > 0,
  };
}

export function buildCumulativeRCurve(trades: EnrichedTradeRow[]): SeriesPoint[] {
  const sorted = sortedTrades(trades).filter((t) => t.computed_r != null);
  let cumulative = 0;
  return sorted.map((t) => {
    cumulative += t.computed_r ?? 0;
    return { date: t.trading_date, value: cumulative };
  });
}

export function buildMonthlyPerformance(trades: EnrichedTradeRow[]): SeriesPoint[] {
  const byMonth = new Map<string, number>();
  for (const t of trades) {
    const key = t.trading_date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.net_profit ?? 0));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [year, month] = key.split('-');
      const label = `${year}-${month}-01`;
      return { date: label, value };
    });
}

function rollingMetric(
  trades: EnrichedTradeRow[],
  window: number,
  compute: (slice: EnrichedTradeRow[]) => number | null,
): RollingMetricPoint[] {
  const sorted = sortedTrades(trades);
  const points: RollingMetricPoint[] = [];
  for (let i = window - 1; i < sorted.length; i++) {
    const slice = sorted.slice(i - window + 1, i + 1);
    const value = compute(slice);
    if (value != null) {
      points.push({
        tradeIndex: i + 1,
        date: sorted[i].trading_date,
        value,
      });
    }
  }
  return points;
}

export function buildRollingExpectancy(trades: EnrichedTradeRow[]): RollingMetricPoint[] {
  return rollingMetric(trades, ROLLING_WINDOW, expectancyR);
}

export function buildRollingProfitFactor(trades: EnrichedTradeRow[]): RollingMetricPoint[] {
  return rollingMetric(trades, ROLLING_WINDOW, (slice) => profitFactor(slice));
}

export function buildRollingWinRate(trades: EnrichedTradeRow[]): RollingMetricPoint[] {
  return rollingMetric(trades, ROLLING_WINDOW, winRate);
}

function buildSetupRow(
  dimension: SetupAnalyticsRow['dimension'],
  key: string,
  label: string,
  slice: EnrichedTradeRow[],
): SetupAnalyticsRow {
  const count = slice.length;
  const expR = expectancyR(slice);
  const expDollars = expectancyDollars(slice);
  const pf = profitFactor(slice);
  const { maxDdPct } = drawdownSeries(slice, 0);
  return {
    dimension,
    key,
    label,
    tradeCount: count,
    winRate: winRate(slice),
    expectancyR: expR,
    expectancyDollars: expDollars,
    profitFactor: pf,
    avgR: avgR(slice),
    confidenceLevel: confidenceLevelForCount(count),
    edgeStatus: determineEdgeStatus(count, expR, expDollars, pf, maxDdPct),
  };
}

function groupSetupAnalytics<T extends string>(
  trades: EnrichedTradeRow[],
  dimension: SetupAnalyticsRow['dimension'],
  picker: (t: EnrichedTradeRow) => T | null,
  labeler: (v: T) => string,
): SetupAnalyticsRow[] {
  const groups = new Map<string, EnrichedTradeRow[]>();
  for (const t of trades) {
    const key = picker(t);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(t);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .map(([key, slice]) => buildSetupRow(dimension, key, labeler(key as T), slice))
    .sort((a, b) => (b.expectancyR ?? -999) - (a.expectancyR ?? -999));
}

export function computeSetupAnalytics(trades: EnrichedTradeRow[]): SetupAnalyticsRow[] {
  const rows: SetupAnalyticsRow[] = [
    ...groupSetupAnalytics(trades, 'location', (t) => t.location, (v) => locationLabel(v)),
    ...groupSetupAnalytics(trades, 'behavior', (t) => t.behavior, (v) => behaviorLabel(v)),
    ...groupSetupAnalytics(trades, 'confirmation', (t) => t.confirmation, (v) => confirmationLabel(v)),
    ...groupSetupAnalytics(trades, 'strategy', (t) => t.auction_strategy, (v) => strategyLabel(v)),
    ...groupSetupAnalytics(trades, 'day_type', (t) => t.day_type, (v) => dayTypeLabel(v)),
  ];
  return rows.sort((a, b) => (b.expectancyR ?? -999) - (a.expectancyR ?? -999));
}

export function discoverEdgePatterns(trades: EnrichedTradeRow[]): EdgePatternRow[] {
  const groups = new Map<string, EnrichedTradeRow[]>();
  for (const t of trades) {
    if (!t.location || !t.behavior || !t.confirmation) continue;
    const key = `${t.location}|${t.behavior}|${t.confirmation}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(t);
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .filter(([, slice]) => slice.length >= MIN_PATTERN_TRADES)
    .map(([key, slice]) => {
      const [location, behavior, confirmation] = key.split('|') as [
        AuctionLocation,
        MarketBehavior,
        ConfirmationTrigger,
      ];
      const expR = expectancyR(slice);
      return {
        location,
        locationLabel: locationLabel(location),
        behavior,
        behaviorLabel: behaviorLabel(behavior),
        confirmation,
        confirmationLabel: confirmationLabel(confirmation),
        tradeCount: slice.length,
        winRate: winRate(slice),
        expectancyR: expR,
        profitFactor: profitFactor(slice),
        confidenceLevel: confidenceLevelForCount(slice.length),
      };
    })
    .sort((a, b) => (b.expectancyR ?? -999) - (a.expectancyR ?? -999));
}

export function computeProcessGrades(trades: EnrichedTradeRow[]): ProcessGradeStats[] {
  const grades: ProcessGrade[] = ['A', 'B', 'C', 'D', 'F'];
  return grades.map((grade) => {
    const slice = trades.filter((t) => t.process_grade === grade);
    const score = grade === 'A' ? 4 : grade === 'B' ? 3 : grade === 'C' ? 2 : grade === 'D' ? 1 : 0;
    return {
      grade,
      score,
      tradeCount: slice.length,
      winRate: winRate(slice),
      expectancyR: expectancyR(slice),
      expectancyDollars: expectancyDollars(slice),
    };
  });
}

export function avgProcessScore(trades: EnrichedTradeRow[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((s, t) => s + t.process_score, 0) / trades.length;
}

function streakStats(trades: EnrichedTradeRow[]): {
  maxWins: number;
  maxLosses: number;
  currentType: RiskAnalytics['currentStreakType'];
  currentCount: number;
} {
  const sorted = sortedTrades(trades);
  let maxWins = 0;
  let maxLosses = 0;
  let winStreak = 0;
  let lossStreak = 0;

  for (const t of sorted) {
    const pnl = Number(t.net_profit ?? 0);
    if (pnl > 0) {
      winStreak++;
      lossStreak = 0;
      maxWins = Math.max(maxWins, winStreak);
    } else if (pnl < 0) {
      lossStreak++;
      winStreak = 0;
      maxLosses = Math.max(maxLosses, lossStreak);
    } else {
      winStreak = 0;
      lossStreak = 0;
    }
  }

  const last = sorted.at(-1);
  if (!last) return { maxWins, maxLosses, currentType: 'none', currentCount: 0 };
  const lastPnl = Number(last.net_profit ?? 0);
  if (lastPnl > 0) {
    let count = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (Number(sorted[i].net_profit ?? 0) > 0) count++;
      else break;
    }
    return { maxWins, maxLosses, currentType: 'win', currentCount: count };
  }
  if (lastPnl < 0) {
    let count = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (Number(sorted[i].net_profit ?? 0) < 0) count++;
      else break;
    }
    return { maxWins, maxLosses, currentType: 'loss', currentCount: count };
  }
  return { maxWins, maxLosses, currentType: 'flat', currentCount: 0 };
}

export function computeRiskAnalytics(
  trades: EnrichedTradeRow[],
  startingCapital: number,
): RiskAnalytics {
  const pnls = trades.map((t) => Number(t.net_profit ?? 0));
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const { maxDd, maxDdPct, currentDd, currentDdPct } = drawdownSeries(trades, startingCapital);
  const streak = streakStats(trades);

  const risks: number[] = [];
  for (const t of trades) {
    if (t.entry_price != null && t.stop_price != null && t.size != null && t.size > 0) {
      const m = computeRiskRewardMetrics({
        symbol: t.symbol as AssetSymbol,
        direction: t.direction,
        entry_price: t.entry_price,
        stop_price: t.stop_price,
        target_price: null,
        volume: t.size,
      });
      if (m) risks.push(m.total_risk);
    }
  }

  return {
    maxDrawdownDollars: maxDd,
    maxDrawdownPct: maxDdPct,
    currentDrawdownDollars: currentDd,
    currentDrawdownPct: currentDdPct,
    largestWin: wins.length ? Math.max(...wins) : 0,
    largestLoss: losses.length ? Math.min(...losses) : 0,
    avgRiskPerTrade: risks.length ? risks.reduce((s, r) => s + r, 0) / risks.length : null,
    maxConsecutiveWins: streak.maxWins,
    maxConsecutiveLosses: streak.maxLosses,
    currentStreakType: streak.currentType,
    currentStreakCount: streak.currentCount,
  };
}

export function computeStrategyHealth(trades: EnrichedTradeRow[]): StrategyHealth {
  const sorted = sortedTrades(trades);
  const count = sorted.length;

  if (count < SAMPLE_MINIMUM) {
    return {
      status: 'no_edge',
      summary: `Need ${SAMPLE_MINIMUM - count} more closed trades before health monitoring is meaningful.`,
      rollingExpectancyR: null,
      historicalExpectancyR: expectancyR(sorted),
      rollingProfitFactor: null,
      historicalProfitFactor: profitFactor(sorted),
      recentWinRate: null,
      historicalWinRate: winRate(sorted),
    };
  }

  const recent = sorted.slice(-ROLLING_WINDOW);
  const historical = sorted.slice(0, Math.max(0, sorted.length - ROLLING_WINDOW));

  const rollingExp = expectancyR(recent);
  const historicalExp = expectancyR(historical.length ? historical : sorted);
  const rollingPf = profitFactor(recent);
  const historicalPf = profitFactor(historical.length ? historical : sorted);
  const recentWr = winRate(recent);
  const historicalWr = winRate(historical.length ? historical : sorted);

  let status: StrategyHealthStatus = 'stable_edge';
  let summary = 'Edge metrics are stable versus historical baseline.';

  const expDelta = (rollingExp ?? 0) - (historicalExp ?? 0);
  const pfDelta = (rollingPf ?? 0) - (historicalPf ?? 0);

  if ((rollingExp ?? 0) <= 0 && (rollingPf ?? 0) < 1) {
    status = 'no_edge';
    summary = 'Recent 30-trade window shows no positive expectancy or profit factor.';
  } else if (expDelta > 0.15 && pfDelta > 0.1) {
    status = 'growing_edge';
    summary = 'Rolling expectancy and profit factor are improving versus history.';
  } else if (expDelta < -0.15 || pfDelta < -0.15 || recentWr < historicalWr - 0.1) {
    status = 'deteriorating_edge';
    summary = 'Recent performance is weaker than historical — review process adherence.';
  }

  return {
    status,
    summary,
    rollingExpectancyR: rollingExp,
    historicalExpectancyR: historicalExp,
    rollingProfitFactor: rollingPf,
    historicalProfitFactor: historicalPf,
    recentWinRate: recentWr,
    historicalWinRate: historicalWr,
  };
}

export function buildStrategyPnlCurve(trades: EnrichedTradeRow[]): SeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const t of sortedTrades(trades)) {
    byDate.set(t.trading_date, (byDate.get(t.trading_date) ?? 0) + Number(t.net_profit ?? 0));
  }
  let cumulative = 0;
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => {
      cumulative += pnl;
      return { date, value: cumulative };
    });
}

export function buildAccountEquityCurve(
  trades: EnrichedTradeRow[],
  startingCapital: number,
): SeriesPoint[] {
  return drawdownSeries(trades, startingCapital).equity;
}

export function computeStrategyBundles(trades: EnrichedTradeRow[]): StrategyAnalyticsBundle[] {
  return ALL_AUCTION_STRATEGIES.map((strategy) => {
    const slice = trades.filter((t) => t.auction_strategy === strategy);
    return {
      strategy,
      label: strategyLabel(strategy),
      edgeAssessment: computeEdgeAssessment(slice, 0),
      strategyHealth: computeStrategyHealth(slice),
      strategyPnlCurve: buildStrategyPnlCurve(slice),
      cumulativeRCurve: buildCumulativeRCurve(slice),
      monthlyPerformance: buildMonthlyPerformance(slice),
      rollingExpectancy: buildRollingExpectancy(slice),
      rollingProfitFactor: buildRollingProfitFactor(slice),
      rollingWinRate: buildRollingWinRate(slice),
      setupAnalytics: computeSetupAnalytics(slice).filter((r) => r.dimension !== 'strategy'),
      edgePatterns: discoverEdgePatterns(slice),
      processGrades: computeProcessGrades(slice),
      avgProcessScore: avgProcessScore(slice),
      riskAnalytics: computeRiskAnalytics(slice, 0),
    };
  });
}

export function buildDaySummaries(trades: EnrichedTradeRow[]): Map<string, import('./dashboard.types').DayTradeSummary> {
  const map = new Map<string, import('./dashboard.types').DayTradeSummary>();
  for (const t of trades) {
    const existing = map.get(t.trading_date) ?? {
      date: t.trading_date,
      tradeCount: 0,
      netPnl: 0,
      winCount: 0,
      lossCount: 0,
    };
    const pnl = Number(t.net_profit ?? 0);
    existing.tradeCount++;
    existing.netPnl += pnl;
    if (pnl > 0) existing.winCount++;
    else if (pnl < 0) existing.lossCount++;
    map.set(t.trading_date, existing);
  }
  return map;
}
