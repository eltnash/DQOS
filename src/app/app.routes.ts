import { Routes } from '@angular/router';

import { accountConfigGuard } from './core/accounts/account-config.guard';
import { AccountRedirectComponent } from './core/accounts/account-redirect.component';
import { accountOwnershipGuard } from './core/accounts/account-ownership.guard';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { AccountSettingsPageComponent } from './features/account-settings/account-settings-page.component';
import { AccountsHomePageComponent } from './features/accounts/accounts-home-page.component';
import { LoginComponent } from './features/auth/login/login.component';
import { GatekeeperPageComponent } from './features/gatekeeper/gatekeeper-page.component';
import { JournalPageComponent } from './features/journal/journal-page.component';
import { TradeLedgerPageComponent } from './features/trade-ledger/trade-ledger-page.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { FeaturePlaceholderComponent } from './shared/components/feature-placeholder/feature-placeholder.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    component: LoginComponent,
  },
  {
    path: '',
    canActivate: [authGuard],
    component: MainLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'accounts' },
      {
        path: 'accounts',
        component: AccountsHomePageComponent,
      },
      {
        path: 'accounts/:accountId',
        canActivate: [accountOwnershipGuard],
        children: [
          { path: '', pathMatch: 'full', component: AccountRedirectComponent },
          {
            path: 'settings',
            component: AccountSettingsPageComponent,
          },
          {
            path: 'dashboard',
            canActivate: [accountConfigGuard],
            component: FeaturePlaceholderComponent,
            data: {
              title: 'Dashboard',
              subtitle: 'Process metrics & downstream outcomes',
              description:
                'KPI cards, equity curve, and recent trades will render here per docs/02_DASHBOARD_PAGE/.',
            },
          },
          {
            path: 'gatekeeper',
            canActivate: [accountConfigGuard],
            component: GatekeeperPageComponent,
          },
          {
            path: 'journal',
            canActivate: [accountConfigGuard],
            component: JournalPageComponent,
          },
          {
            path: 'trade-history',
            canActivate: [accountConfigGuard],
            component: TradeLedgerPageComponent,
          },
          {
            path: 'setups',
            canActivate: [accountConfigGuard],
            component: FeaturePlaceholderComponent,
            data: {
              title: 'Setups Library',
              subtitle: 'Playbook & rules',
              description: 'Setup cards and rule drilldown per docs/06_SETUPS_LIBRARY_PAGE/.',
            },
          },
          {
            path: 'lab',
            canActivate: [accountConfigGuard],
            component: FeaturePlaceholderComponent,
            data: {
              title: 'Edge Discovery Lab',
              subtitle: 'Quantitative research',
              description: 'Insight feed and analytics workspace per docs/07_EDGE_DISCOVERY_LAB/.',
            },
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'accounts' },
];
