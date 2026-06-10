import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

import { TradingAccountService } from '../../core/accounts/trading-account.service';
import { PageSkeletonComponent } from '../../shared/components/page-skeleton/page-skeleton.component';

@Component({
  selector: 'app-accounts-home-page',
  imports: [CardModule, ButtonModule, PageSkeletonComponent],
  templateUrl: './accounts-home-page.component.html',
  styleUrl: './accounts-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsHomePageComponent implements OnInit {
  private readonly accountService = inject(TradingAccountService);
  private readonly router = inject(Router);

  protected readonly accounts = this.accountService.accounts;
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      const list = await this.accountService.loadAccounts();
      if (list.length === 1) {
        const account = list[0];
        const target = this.accountService.isConfigured(account) ? 'dashboard' : 'settings';
        await this.router.navigate(['/accounts', account.id, target]);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
