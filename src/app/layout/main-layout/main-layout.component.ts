import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  ActivatedRoute,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs/operators';

import { AccountScopeService } from '../../core/accounts/account-scope.service';
import { ShellLayoutService } from '../../core/accounts/shell-layout.service';
import {
  PageSkeletonComponent,
  type PageSkeletonLayout,
} from '../../shared/components/page-skeleton/page-skeleton.component';
import { AccountRailComponent } from '../account-rail/account-rail.component';
import { AccountSidebarComponent } from '../account-sidebar/account-sidebar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, AccountRailComponent, AccountSidebarComponent, PageSkeletonComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shellLayout = inject(ShellLayoutService);
  private readonly accountScope = inject(AccountScopeService);

  protected readonly accountId = signal<string | null>(null);
  protected readonly navigating = signal(false);
  protected readonly skeletonLayout = signal<PageSkeletonLayout>('form');
  protected readonly accountRailCollapsed = this.shellLayout.accountRailCollapsed;
  protected readonly sectionSidebarCollapsed = this.shellLayout.sectionSidebarCollapsed;

  private currentPath = this.router.url.split('?')[0];

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

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        const nextPath = event.url.split('?')[0];
        if (nextPath !== this.currentPath) {
          this.navigating.set(true);
          this.skeletonLayout.set(this.skeletonForPath(nextPath));
        }
        return;
      }

      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        const path =
          event instanceof NavigationEnd ? event.urlAfterRedirects.split('?')[0] : this.currentPath;
        this.currentPath = path;
        this.navigating.set(false);
      }
    });

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

  private skeletonForPath(path: string): PageSkeletonLayout {
    if (path.includes('/dashboard')) {
      return 'dashboard';
    }
    if (path.includes('/journal') || path.includes('/trade-history')) {
      return 'table';
    }
    if (path.includes('/gallery')) {
      return 'cards';
    }
    return 'form';
  }
}
