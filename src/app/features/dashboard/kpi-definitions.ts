export interface KpiDefinition {
  key: string;
  name: string;
  formula: string;
  meaning: string;
  whyItMatters: string;
  benchmark: string;
  warning: string;
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    key: 'profit_factor',
    name: 'Profit Factor',
    formula: 'Gross Profit ÷ Gross Loss',
    meaning: 'How many dollars you earn per dollar lost.',
    whyItMatters: 'Separates lucky streaks from structurally profitable systems.',
    benchmark: '≥ 1.5 strong · 1.2–1.5 acceptable · < 1.0 no edge',
    warning: 'Below 1.0 means losses exceed wins — negative expectancy.',
  },
  {
    key: 'expectancy',
    name: 'Expectancy (R)',
    formula: '(Win% × Avg Win R) − (Loss% × Avg Loss R)',
    meaning: 'Average R gained or lost per trade over the sample.',
    whyItMatters: 'The core edge metric — positive expectancy is required for long-term survival.',
    benchmark: '≥ +0.5R strong · +0.2R to +0.5R viable · ≤ 0 no edge',
    warning: 'Positive dollar P&L with negative R expectancy usually means oversized wins, not edge.',
  },
  {
    key: 'avg_r',
    name: 'Average R',
    formula: 'Sum of R-multiples ÷ Trade count',
    meaning: 'Mean outcome expressed in units of initial risk.',
    whyItMatters: 'Normalizes performance across different position sizes and instruments.',
    benchmark: '≥ +0.3R per trade is solid for discretionary systems',
    warning: 'Large negative avg R with few trades can still be noise — check sample size.',
  },
  {
    key: 'win_rate',
    name: 'Win Rate',
    formula: 'Winning trades ÷ Total closed trades',
    meaning: 'Frequency of profitable outcomes.',
    whyItMatters: 'Must be read with avg win/loss — low win rate can still be highly profitable.',
    benchmark: 'Varies by style; 40–55% common for R:R > 1 systems',
    warning: 'High win rate with negative expectancy often signals poor risk/reward.',
  },
  {
    key: 'max_drawdown',
    name: 'Maximum Drawdown',
    formula: 'Largest peak-to-trough decline in equity',
    meaning: 'Worst capital erosion from a prior high.',
    whyItMatters: 'Determines psychological survivability and capital required to continue.',
    benchmark: 'Prop firms often cap 8–12% · discretionary traders target < 20%',
    warning: 'Drawdowns deeper than 25% often force process abandonment before edge plays out.',
  },
  {
    key: 'recovery_factor',
    name: 'Recovery Factor',
    formula: 'Net Profit ÷ Max Drawdown',
    meaning: 'How efficiently profits recover from the worst drawdown.',
    whyItMatters: 'High recovery factor confirms edge persists through adverse periods.',
    benchmark: '≥ 3 excellent · 1–3 acceptable · < 1 net loss exceeds worst DD',
    warning: 'Below 1.0 means you have not recovered from your worst period.',
  },
  {
    key: 'sqn',
    name: 'SQN (System Quality Number)',
    formula: '√N × (Avg R ÷ Std Dev of R)',
    meaning: 'Van Tharp measure of system quality scaled by sample size.',
    whyItMatters: 'Combines edge magnitude with consistency and statistical weight.',
    benchmark: '1.6–2.5 good · 2.5–3.5 excellent · 3.5+ superb (with adequate N)',
    warning: 'SQN below 1.6 with N < 100 is not actionable — increase sample first.',
  },
  {
    key: 'sharpe',
    name: 'Per-Trade Sharpe',
    formula: 'Mean R ÷ Std Dev R (per-trade, not annualized)',
    meaning: 'Risk-adjusted return per trade in R units.',
    whyItMatters: 'Shows whether returns compensate for outcome volatility.',
    benchmark: '≥ 0.5 reasonable · ≥ 1.0 strong for discrete trade samples',
    warning: 'Very low Sharpe with positive expectancy suggests inconsistent execution.',
  },
  {
    key: 'risk_of_ruin',
    name: 'Risk of Ruin (approx.)',
    formula: 'Based on win rate and win/loss payoff ratio',
    meaning: 'Estimated probability of losing a defined fraction of capital.',
    whyItMatters: 'Reveals whether position sizing is compatible with your edge.',
    benchmark: '< 5% acceptable for professional risk tolerance',
    warning: 'Above 10% suggests oversizing relative to edge quality.',
  },
  {
    key: 'process_score',
    name: 'Process Score',
    formula: 'Location + Behavior + Confirmation + Invalidation (4 pillars)',
    meaning: 'Whether the trade met your full qualification framework before entry.',
    whyItMatters: 'Edge lives in process — breaking pillars usually degrades expectancy.',
    benchmark: '4/4 (A) on every qualified trade · win rate should rise with score',
    warning: 'Winning on 2/4 trades often indicates luck, not repeatable edge.',
  },
];
