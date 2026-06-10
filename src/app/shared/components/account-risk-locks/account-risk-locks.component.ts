import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AccountRiskService } from '../../../core/accounts/account-risk.service';
import { formatRiskLockLine } from '../../../core/accounts/account-risk.utils';

@Component({
  selector: 'app-account-risk-locks',
  imports: [RouterLink],
  template: `
    @if (locks().length > 0) {
      <ul class="risk-locks">
        @for (lock of lockLines(); track lock.violation) {
          <li class="risk-locks__item">{{ lock.text }}</li>
        }
      </ul>
      @if (showSettingsLink() && accountId(); as id) {
        <a class="risk-locks__link" [routerLink]="['/accounts', id, 'settings']">Open Settings</a>
      }
    }
  `,
  styles: `
    .risk-locks {
      margin: 0;
      padding-left: 1.1rem;
      color: #fcd34d;
      font-size: 0.8125rem;
      line-height: 1.5;
    }

    .risk-locks__item + .risk-locks__item {
      margin-top: 0.25rem;
    }

    .risk-locks__link {
      display: inline-block;
      margin-top: 0.5rem;
      color: #fbbf24;
      font-size: 0.8125rem;
      font-weight: 600;
      text-decoration: underline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountRiskLocksComponent {
  private readonly riskService = inject(AccountRiskService);

  readonly accountId = input<string | null>(null);
  readonly showSettingsLink = input(true);

  protected readonly locks = computed(() => this.riskService.status().locks);

  protected readonly lockLines = computed(() => {
    this.riskService.clock();
    const now = new Date(this.riskService.clock());
    return this.locks().map((lock) => ({
      violation: lock.violation,
      text: formatRiskLockLine(lock, now),
    }));
  });
}
