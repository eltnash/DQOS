import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AccountRiskService } from '../../core/accounts/account-risk.service';
import { accountTypeLabel, formatAccountBalance } from '../../core/accounts/account.utils';
import { AccountRiskLocksComponent } from '../../shared/components/account-risk-locks/account-risk-locks.component';
import { ShellLayoutService } from '../../core/accounts/shell-layout.service';
import { TradingAccountService } from '../../core/accounts/trading-account.service';
import { AuthService } from '../../core/auth/auth.service';

interface SectionNavItem {
  label: string;
  segment: string;
  icon: string;
  locked?: boolean;
}

@Component({
  selector: 'app-account-sidebar',
  imports: [RouterLink, RouterLinkActive, AccountRiskLocksComponent],
  templateUrl: './account-sidebar.component.html',
  styleUrl: './account-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSidebarComponent {
  private readonly accountService = inject(TradingAccountService);
  private readonly riskService = inject(AccountRiskService);
  private readonly shellLayout = inject(ShellLayoutService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly accountId = input.required<string>();

  protected readonly account = this.accountService.active;
  protected readonly collapsed = this.shellLayout.sectionSidebarCollapsed;

  protected readonly configured = computed(() => {
    const acc = this.account();
    return acc ? this.accountService.isConfigured(acc) : false;
  });

  protected readonly formatBalance = formatAccountBalance;
  protected readonly typeLabel = accountTypeLabel;
  protected readonly riskBlocked = computed(() => this.riskService.status().blocked);

  protected readonly navItems = computed((): SectionNavItem[] => {
    const locked = !this.configured();
    return [
      { label: 'Dashboard', segment: 'dashboard', icon: 'pi pi-chart-bar', locked },
      { label: 'Gatekeeper', segment: 'gatekeeper', icon: 'pi pi-shield', locked },
      { label: 'Journal', segment: 'journal', icon: 'pi pi-table', locked },
      { label: 'Trade History', segment: 'trade-history', icon: 'pi pi-list', locked },
      { label: 'Setups', segment: 'setups', icon: 'pi pi-book', locked },
      { label: 'Gallery', segment: 'gallery', icon: 'pi pi-images', locked },
      { label: 'Edge Lab', segment: 'lab', icon: 'pi pi-sparkles', locked },
    ];
  });

  protected readonly userEmail = () => this.auth.user()?.email ?? '';

  protected toggleCollapse(): void {
    this.shellLayout.toggleSectionSidebar();
  }

  protected collapseAll(): void {
    this.shellLayout.collapseAll();
  }

  protected expandAll(): void {
    this.shellLayout.expandAll();
  }

  protected navLink(item: SectionNavItem): string[] {
    return ['/accounts', this.accountId(), item.segment];
  }

  protected onNavClick(item: SectionNavItem, event: Event): void {
    if (!item.locked) {
      return;
    }
    event.preventDefault();
    void this.router.navigate(['/accounts', this.accountId(), 'settings']);
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
