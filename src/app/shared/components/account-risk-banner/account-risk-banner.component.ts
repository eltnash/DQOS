import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageModule } from 'primeng/message';

import { AccountRiskService } from '../../../core/accounts/account-risk.service';
import { formatRiskAlertDetail } from '../../../core/accounts/account-risk.utils';
import { TradingAccountService } from '../../../core/accounts/trading-account.service';

@Component({
  selector: 'app-account-risk-banner',
  imports: [MessageModule, RouterLink],
  template: `
    @if (blocked()) {
      <div class="account-risk-banner">
        <p-message severity="warn" [text]="detail()" />
        @if (accountId(); as id) {
          <a class="account-risk-banner__link" [routerLink]="['/accounts', id, 'settings']">Update rules in Settings</a>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 1rem;
    }

    .account-risk-banner__link {
      display: inline-block;
      margin-top: 0.5rem;
      color: #fbbf24;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: underline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountRiskBannerComponent {
  private readonly riskService = inject(AccountRiskService);
  private readonly accountService = inject(TradingAccountService);

  readonly accountId = input<string | null>(null);

  protected readonly blocked = computed(() => this.riskService.status().blocked);
  protected readonly detail = computed(() => {
    const status = this.riskService.status();
    const currency = this.accountService.active()?.currency ?? 'USD';
    return formatRiskAlertDetail(status, currency);
  });
}
