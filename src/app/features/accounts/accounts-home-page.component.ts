import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

import { TradingAccountService } from '../../core/accounts/trading-account.service';

@Component({
  selector: 'app-accounts-home-page',
  imports: [CardModule, ButtonModule],
  templateUrl: './accounts-home-page.component.html',
  styleUrl: './accounts-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsHomePageComponent implements OnInit {
  private readonly accountService = inject(TradingAccountService);
  private readonly router = inject(Router);

  protected readonly accounts = this.accountService.accounts;

  async ngOnInit(): Promise<void> {
    const list = await this.accountService.loadAccounts();
    if (list.length === 1) {
      const account = list[0];
      const target = this.accountService.isConfigured(account) ? 'dashboard' : 'settings';
      await this.router.navigate(['/accounts', account.id, target]);
    }
  }
}
