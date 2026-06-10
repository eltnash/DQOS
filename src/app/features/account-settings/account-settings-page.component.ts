import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';

import { TradingAccountService } from '../../core/accounts/trading-account.service';
import type { TradingAccountType } from '../../core/models/database.types';

@Component({
  selector: 'app-account-settings-page',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    SelectButtonModule,
    ButtonModule,
    MessageModule,
  ],
  templateUrl: './account-settings-page.component.html',
  styleUrl: './account-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettingsPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountService = inject(TradingAccountService);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly account = this.accountService.active;

  protected readonly typeOptions = [
    { label: 'Demo', value: 'demo' as const },
    { label: 'Live', value: 'live' as const },
  ];

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    account_type: ['demo' as TradingAccountType, Validators.required],
    starting_capital: [10_000, [Validators.required, Validators.min(0.01)]],
    max_drawdown_pct: [10, [Validators.required, Validators.min(0.01)]],
    daily_drawdown_pct: [5, [Validators.required, Validators.min(0.01)]],
  });

  async ngOnInit(): Promise<void> {
    const accountId = this.route.parent?.snapshot.paramMap.get('accountId');
    if (!accountId) {
      return;
    }

    const acc = await this.accountService.getAccount(accountId);
    if (!acc) {
      return;
    }

    this.form.patchValue({
      name: acc.name,
      account_type: acc.account_type,
      starting_capital: acc.starting_capital != null ? Number(acc.starting_capital) : 10_000,
      max_drawdown_pct: acc.max_drawdown_pct != null ? Number(acc.max_drawdown_pct) : 10,
      daily_drawdown_pct: acc.daily_drawdown_pct != null ? Number(acc.daily_drawdown_pct) : 5,
    });
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const accountId = this.route.parent?.snapshot.paramMap.get('accountId');
    if (!accountId) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const value = this.form.getRawValue();
      await this.accountService.updateSettings(accountId, value);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (returnUrl?.startsWith('/accounts/')) {
        await this.router.navigateByUrl(returnUrl);
      } else {
        await this.router.navigate(['/accounts', accountId, 'dashboard']);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      this.saving.set(false);
    }
  }
}
