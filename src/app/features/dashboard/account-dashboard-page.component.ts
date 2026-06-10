import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
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
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AccountRiskBannerComponent } from '../../shared/components/account-risk-banner/account-risk-banner.component';
import { AccountRiskLocksComponent } from '../../shared/components/account-risk-locks/account-risk-locks.component';

@Component({
  selector: 'app-account-dashboard-page',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    CardModule,
    MessageModule,
    ProgressBarModule,
    ProgressSpinnerModule,
    TagModule,
    AccountRiskBannerComponent,
    AccountRiskLocksComponent,
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
  private readonly supabase = inject(SupabaseService);

  protected readonly loading = signal(true);
  protected readonly closedTradeCount = signal(0);
  protected readonly account = this.accountService.active;
  protected readonly riskStatus = this.riskService.status;
  protected readonly accountId = this.accountScope.accountId;

  protected readonly formatBalance = formatAccountBalance;
  protected readonly typeLabel = accountTypeLabel;
  protected readonly riskUsageProgress = riskUsageProgress;
  protected readonly riskUsageSeverity = riskUsageSeverity;

  protected readonly netPnl = computed(() => {
    const acc = this.account();
    if (!acc?.starting_capital || acc.current_balance == null) {
      return 0;
    }
    return Number(acc.current_balance) - Number(acc.starting_capital);
  });

  protected readonly riskLimits = computed(() => {
    const acc = this.account();
    if (!acc) {
      return [];
    }
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
    if (!lock) {
      return null;
    }
    return formatRiskLockLine(lock, new Date(this.riskService.clock()));
  }

  async ngOnInit(): Promise<void> {
    const accountId = this.route.parent?.snapshot.paramMap.get('accountId');
    if (!accountId) {
      this.loading.set(false);
      return;
    }

    try {
      await this.accountService.getAccount(accountId);
      await this.riskService.evaluate(accountId);
      await this.loadClosedTradeCount(accountId);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadClosedTradeCount(accountId: string): Promise<void> {
    const { count, error } = await this.supabase.client
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('status', 'CLOSED');

    if (error) {
      return;
    }

    this.closedTradeCount.set(count ?? 0);
  }
}
