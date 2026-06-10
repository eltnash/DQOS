import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';

import {
  buildRiskLimitUsage,
  formatRiskLockLine,
  formatRiskMetricsDetail,
  riskUsageProgress,
  riskUsageSeverity,
  type AccountRiskViolation,
} from '../../core/accounts/account-risk.utils';
import { AccountRiskService } from '../../core/accounts/account-risk.service';
import { AccountScopeService } from '../../core/accounts/account-scope.service';
import { accountTypeLabel, formatAccountBalance } from '../../core/accounts/account.utils';
import { TradingAccountService } from '../../core/accounts/trading-account.service';
import type { AuctionStrategy } from '../../core/models/database.types';
import { AccountRiskBannerComponent } from '../../shared/components/account-risk-banner/account-risk-banner.component';
import { AccountRiskLocksComponent } from '../../shared/components/account-risk-locks/account-risk-locks.component';
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import type { ProfessionalDashboardSnapshot, StrategyAnalyticsBundle } from './dashboard.types';
import { EdgeAssessmentSectionComponent } from './components/edge-assessment-section/edge-assessment-section.component';
import { EdgeDiscoverySectionComponent } from './components/edge-discovery-section/edge-discovery-section.component';
import { ExecutionQualitySectionComponent } from './components/execution-quality-section/execution-quality-section.component';
import { KpiGlossarySectionComponent } from './components/kpi-glossary-section/kpi-glossary-section.component';
import { PerformanceAnalyticsSectionComponent } from './components/performance-analytics-section/performance-analytics-section.component';
import { RiskAnalyticsSectionComponent } from './components/risk-analytics-section/risk-analytics-section.component';
import { SetupAnalyticsSectionComponent } from './components/setup-analytics-section/setup-analytics-section.component';
import { StrategyHealthSectionComponent } from './components/strategy-health-section/strategy-health-section.component';

@Component({
  selector: 'app-account-dashboard-page',
  imports: [
    DecimalPipe,
    FormsModule,
    MessageModule,
    ProgressBarModule,
    ProgressSpinnerModule,
    SelectButtonModule,
    TagModule,
    AccountRiskBannerComponent,
    AccountRiskLocksComponent,
    EdgeAssessmentSectionComponent,
    PerformanceAnalyticsSectionComponent,
    SetupAnalyticsSectionComponent,
    EdgeDiscoverySectionComponent,
    ExecutionQualitySectionComponent,
    RiskAnalyticsSectionComponent,
    StrategyHealthSectionComponent,
    KpiGlossarySectionComponent,
  ],
  templateUrl: './account-dashboard-page.component.html',
  styleUrl: './account-dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountDashboardPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly accountService = inject(TradingAccountService);
  private readonly riskService = inject(AccountRiskService);
  private readonly accountScope = inject(AccountScopeService);
  private readonly analyticsService = inject(DashboardAnalyticsService);

  protected readonly loading = signal(true);
  protected readonly snapshot = signal<ProfessionalDashboardSnapshot | null>(null);
  protected readonly activeStrategy = signal<AuctionStrategy>('Level_Rejection');
  protected readonly account = this.accountService.active;
  protected readonly riskStatus = this.riskService.status;
  protected readonly accountId = this.accountScope.accountId;

  protected readonly formatBalance = formatAccountBalance;
  protected readonly typeLabel = accountTypeLabel;
  protected readonly riskUsageProgress = riskUsageProgress;
  protected readonly riskUsageSeverity = riskUsageSeverity;

  protected readonly currency = computed(() => this.account()?.currency ?? 'USD');

  protected readonly strategyOptions = computed(() => {
    const bundles = this.snapshot()?.strategyBundles ?? [];
    return bundles.map((b) => ({ label: b.label, value: b.strategy }));
  });

  protected readonly activeBundle = computed((): StrategyAnalyticsBundle | null => {
    const data = this.snapshot();
    if (!data) return null;
    return (
      data.strategyBundles.find((b) => b.strategy === this.activeStrategy()) ??
      data.strategyBundles[0] ??
      null
    );
  });

  protected readonly riskLimits = computed(() => {
    const acc = this.account();
    if (!acc) return [];
    return buildRiskLimitUsage(acc, this.riskStatus());
  });

  protected readonly riskMetrics = computed(() => {
    const status = this.riskStatus();
    const currency = this.account()?.currency ?? 'USD';
    return status.blocked ? formatRiskMetricsDetail(status, currency) : null;
  });

  protected lockLineFor(key: 'daily' | 'weekly' | 'max'): string | null {
    this.riskService.clock();
    const violation: AccountRiskViolation =
      key === 'daily' ? 'daily_drawdown' : key === 'weekly' ? 'weekly_drawdown' : 'max_drawdown';
    const lock = this.riskStatus().locks.find((entry) => entry.violation === violation);
    if (!lock) return null;
    return formatRiskLockLine(lock, new Date(this.riskService.clock()));
  }

  async ngOnInit(): Promise<void> {
    const accountId = this.route.parent?.snapshot.paramMap.get('accountId');
    if (!accountId) {
      this.loading.set(false);
      return;
    }

    try {
      const acc = await this.accountService.getAccount(accountId);
      if (!acc) return;
      await this.riskService.evaluate(accountId);
      const data = await this.analyticsService.loadSnapshot(
        accountId,
        Number(acc.starting_capital ?? 0),
      );
      this.snapshot.set(data);
      const withTrades = data.strategyBundles.find((b) => b.edgeAssessment.sampleSize > 0);
      if (withTrades) {
        this.activeStrategy.set(withTrades.strategy);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
