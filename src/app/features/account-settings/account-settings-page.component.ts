import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';

import { accountTypeLabel } from '../../core/accounts/account.utils';
import { AccountRiskService } from '../../core/accounts/account-risk.service';
import { formatRiskMetricsDetail } from '../../core/accounts/account-risk.utils';
import { AccountRiskLocksComponent } from '../../shared/components/account-risk-locks/account-risk-locks.component';
import { PageSkeletonComponent } from '../../shared/components/page-skeleton/page-skeleton.component';
import { AccountScopeService } from '../../core/accounts/account-scope.service';
import { validateDrawdownHierarchy } from '../../core/accounts/drawdown-limits.utils';
import { TradingAccountService } from '../../core/accounts/trading-account.service';

function drawdownHierarchyValidator(control: AbstractControl): ValidationErrors | null {
  const daily = Number(control.get('daily_drawdown_pct')?.value);
  const weekly = Number(control.get('weekly_drawdown_pct')?.value);
  const max = Number(control.get('max_drawdown_pct')?.value);

  const message = validateDrawdownHierarchy({
    daily_drawdown_pct: daily,
    weekly_drawdown_pct: weekly,
    max_drawdown_pct: max,
  });

  return message ? { drawdownHierarchy: message } : null;
}

@Component({
  selector: 'app-account-settings-page',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    TagModule,
    ButtonModule,
    MessageModule,
    ConfirmDialogModule,
    AccountRiskLocksComponent,
    PageSkeletonComponent,
  ],
  templateUrl: './account-settings-page.component.html',
  styleUrl: './account-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService],
})
export class AccountSettingsPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountService = inject(TradingAccountService);
  private readonly riskService = inject(AccountRiskService);
  private readonly accountScope = inject(AccountScopeService);
  private readonly confirmationService = inject(ConfirmationService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly account = this.accountService.active;
  protected readonly riskStatus = this.riskService.status;

  protected readonly settingsAccountId = (): string | null =>
    this.route.parent?.snapshot.paramMap.get('accountId') ?? null;

  protected readonly riskMetrics = computed(() => {
    this.riskService.clock();
    const status = this.riskStatus();
    const currency = this.account()?.currency ?? 'USD';
    return status.blocked ? formatRiskMetricsDetail(status, currency) : null;
  });

  protected readonly hierarchyError = computed(() => {
    const errors = this.form.errors;
    if (errors?.['drawdownHierarchy']) {
      return String(errors['drawdownHierarchy']);
    }
    return null;
  });

  protected readonly typeLabel = accountTypeLabel;

  protected readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      starting_capital: [10_000, [Validators.required, Validators.min(0.01)]],
      daily_drawdown_pct: [5, [Validators.required, Validators.min(0.01)]],
      weekly_drawdown_pct: [8, [Validators.required, Validators.min(0.01)]],
      max_drawdown_pct: [10, [Validators.required, Validators.min(0.01)]],
    },
    { validators: drawdownHierarchyValidator },
  );

  async ngOnInit(): Promise<void> {
    const accountId = this.route.parent?.snapshot.paramMap.get('accountId');
    if (!accountId) {
      this.loading.set(false);
      return;
    }

    try {
      const acc = await this.accountService.getAccount(accountId);
      if (!acc) {
        return;
      }

      await this.riskService.evaluate(accountId);

      const daily = acc.daily_drawdown_pct != null ? Number(acc.daily_drawdown_pct) : 5;
      const weekly =
        acc.weekly_drawdown_pct != null
          ? Number(acc.weekly_drawdown_pct)
          : Math.min(Number(acc.max_drawdown_pct ?? 10), Math.max(daily, daily * 2));
      const max = acc.max_drawdown_pct != null ? Number(acc.max_drawdown_pct) : 10;

      this.form.patchValue({
        name: acc.name,
        starting_capital: acc.starting_capital != null ? Number(acc.starting_capital) : 10_000,
        daily_drawdown_pct: daily,
        weekly_drawdown_pct: weekly,
        max_drawdown_pct: max,
      });
    } finally {
      this.loading.set(false);
    }
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
      await this.riskService.evaluate(accountId);

      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (returnUrl?.startsWith('/accounts/') && !this.riskStatus().blocked) {
        await this.router.navigateByUrl(returnUrl);
      } else if (!this.riskStatus().blocked) {
        await this.router.navigate(['/accounts', accountId, 'dashboard']);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDelete(): void {
    const account = this.account();
    if (!account) {
      return;
    }

    this.confirmationService.confirm({
      header: 'Delete account',
      message: `Delete "${account.name}" and all journals, trades, and screenshots? This cannot be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Delete everything',
      rejectLabel: 'Cancel',
      accept: () => {
        void this.deleteAccount();
      },
    });
  }

  private async deleteAccount(): Promise<void> {
    const accountId = this.route.parent?.snapshot.paramMap.get('accountId');
    if (!accountId) {
      return;
    }

    this.deleting.set(true);
    this.error.set(null);

    try {
      await this.accountService.deleteAccount(accountId);
      this.accountScope.clear();
      await this.accountService.loadAccounts();
      await this.router.navigate(['/accounts']);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not delete account.');
    } finally {
      this.deleting.set(false);
    }
  }
}
