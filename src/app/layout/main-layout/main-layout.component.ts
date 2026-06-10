import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AccountScopeService } from '../../core/accounts/account-scope.service';
import { ShellLayoutService } from '../../core/accounts/shell-layout.service';
import { AccountRailComponent } from '../account-rail/account-rail.component';
import { AccountSidebarComponent } from '../account-sidebar/account-sidebar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, AccountRailComponent, AccountSidebarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shellLayout = inject(ShellLayoutService);
  private readonly accountScope = inject(AccountScopeService);

  protected readonly accountId = signal<string | null>(null);
  protected readonly accountRailCollapsed = this.shellLayout.accountRailCollapsed;
  protected readonly sectionSidebarCollapsed = this.shellLayout.sectionSidebarCollapsed;

  protected readonly gridColumns = computed(() => {
    const rail = this.accountRailCollapsed() ? '48px' : '220px';
    const hasAccount = this.accountId() != null;

    if (!hasAccount) {
      return `${rail} 1fr`;
    }

    const section = this.sectionSidebarCollapsed() ? '48px' : '240px';
    return `${rail} ${section} 1fr`;
  });

  constructor() {
    this.syncAccountFromRoute();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.syncAccountFromRoute());

    effect(() => {
      const cols = this.gridColumns();
      document.documentElement.style.setProperty('--dqos-shell-columns', cols);
    });
  }

  private syncAccountFromRoute(): void {
    let snapshot = this.route.snapshot;
    while (snapshot.firstChild) {
      snapshot = snapshot.firstChild;
    }

    let accountId: string | null = null;
    let node: typeof snapshot | null = snapshot;
    while (node) {
      const id = node.paramMap.get('accountId');
      if (id) {
        accountId = id;
        break;
      }
      node = node.parent;
    }

    this.accountId.set(accountId);

    if (accountId) {
      void this.accountScope.bind(accountId);
    } else {
      this.accountScope.clear();
    }
  }

}
