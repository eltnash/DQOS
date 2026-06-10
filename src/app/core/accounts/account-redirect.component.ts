import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { TradingAccountService } from './trading-account.service';

@Component({
  selector: 'app-account-redirect',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountRedirectComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountService = inject(TradingAccountService);

  async ngOnInit(): Promise<void> {
    const accountId = this.route.snapshot.paramMap.get('accountId');
    if (!accountId) {
      await this.router.navigate(['/accounts']);
      return;
    }

    const account = await this.accountService.getAccount(accountId);
    if (!account) {
      await this.router.navigate(['/accounts']);
      return;
    }

    if (this.accountService.isConfigured(account)) {
      await this.router.navigate(['/accounts', accountId, 'dashboard']);
    } else {
      await this.router.navigate(['/accounts', accountId, 'settings']);
    }
  }
}
