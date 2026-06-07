import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';
import { FeaturePlaceholderComponent } from './shared/components/feature-placeholder/feature-placeholder.component';
import { GatekeeperPageComponent } from './features/gatekeeper/gatekeeper-page.component';
import { LoginComponent } from './features/auth/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

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
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        component: FeaturePlaceholderComponent,
        data: {
          title: 'Dashboard',
          subtitle: 'Process metrics & downstream outcomes',
          description: 'KPI cards, equity curve, and recent trades will render here per docs/02_DASHBOARD_PAGE/.',
        },
      },
      {
        path: 'gatekeeper',
        component: GatekeeperPageComponent,
      },
      {
        path: 'journal',
        component: FeaturePlaceholderComponent,
        data: {
          title: 'Journal Ledger',
          subtitle: 'High-density trade history',
          description: 'Dense grid and filter builder per docs/05_JOURNAL_LEDGER_PAGE/.',
        },
      },
      {
        path: 'setups',
        component: FeaturePlaceholderComponent,
        data: {
          title: 'Setups Library',
          subtitle: 'Playbook & rules',
          description: 'Setup cards and rule drilldown per docs/06_SETUPS_LIBRARY_PAGE/.',
        },
      },
      {
        path: 'lab',
        component: FeaturePlaceholderComponent,
        data: {
          title: 'Edge Discovery Lab',
          subtitle: 'Quantitative research',
          description: 'Insight feed and analytics workspace per docs/07_EDGE_DISCOVERY_LAB/.',
        },
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
