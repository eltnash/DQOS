import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MessageModule } from 'primeng/message';

import { AccountRiskService } from '../../../core/accounts/account-risk.service';
import { AccountRiskLocksComponent } from '../account-risk-locks/account-risk-locks.component';

@Component({
  selector: 'app-account-risk-banner',
  imports: [MessageModule, AccountRiskLocksComponent],
  template: `
    @if (blocked()) {
      <div class="account-risk-banner">
        <p-message severity="warn" text="Account locked — executions and new journal records are paused." />
        <app-account-risk-locks [accountId]="accountId()" />
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 1rem;
    }

  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountRiskBannerComponent {
  private readonly riskService = inject(AccountRiskService);

  readonly accountId = input<string | null>(null);

  protected readonly blocked = computed(() => this.riskService.status().blocked);
}
