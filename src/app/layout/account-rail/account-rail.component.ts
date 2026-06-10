import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';

import { accountTypeLabel, formatAccountBalance } from '../../core/accounts/account.utils';
import { ShellLayoutService } from '../../core/accounts/shell-layout.service';
import { TradingAccountService } from '../../core/accounts/trading-account.service';
import type { TradingAccount, TradingAccountType } from '../../core/models/database.types';

@Component({
  selector: 'app-account-rail',
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectButtonModule,
  ],
  templateUrl: './account-rail.component.html',
  styleUrl: './account-rail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountRailComponent implements OnInit {
  private readonly accountService = inject(TradingAccountService);
  private readonly shellLayout = inject(ShellLayoutService);
  private readonly router = inject(Router);

  readonly activeAccountId = input<string | null>(null);
  readonly accountsLoaded = output<void>();

  protected readonly accounts = this.accountService.accounts;
  protected readonly collapsed = this.shellLayout.accountRailCollapsed;

  protected readonly createVisible = signal(false);
  protected readonly createSaving = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected createName = '';
  protected createType: TradingAccountType = 'demo';

  protected readonly typeOptions = [
    { label: 'Demo', value: 'demo' as const },
    { label: 'Live', value: 'live' as const },
  ];

  protected readonly formatBalance = formatAccountBalance;
  protected readonly typeLabel = accountTypeLabel;

  async ngOnInit(): Promise<void> {
    await this.accountService.loadAccounts();
    this.accountsLoaded.emit();
  }

  protected toggleCollapse(): void {
    this.shellLayout.toggleAccountRail();
  }

  protected openCreate(): void {
    this.createName = '';
    this.createType = 'demo';
    this.createError.set(null);
    this.createVisible.set(true);
  }

  protected async submitCreate(): Promise<void> {
    this.createSaving.set(true);
    this.createError.set(null);
    try {
      const account = await this.accountService.createAccount(this.createName, this.createType);
      this.createVisible.set(false);
      await this.router.navigate(['/accounts', account.id, 'settings']);
    } catch (err) {
      this.createError.set(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      this.createSaving.set(false);
    }
  }
}
