# 02a — Dashboard Overview Metrics

## Module Header

| Field | Value |
|-------|-------|
| **Purpose** | Surface upstream process health (TQS, compliance) alongside downstream trade volume at a glance |
| **Angular Target Path** | `src/app/features/dashboard/components/overview-metrics/` |
| **Route** | `/dashboard` (top section of `DashboardPageComponent`) |
| **Supabase Tables / Views** | `v_process_compliance_summary`, `trades` |
| **Key Metrics** | Avg TQS, Process Compliance %, Closed Trade Count, Qualified Ratio |

---

## Philosophy

The dashboard KPI strip answers one question: *"Am I trading with process, and how often?"* Metrics are split intentionally:

- **Upstream (cause):** Avg TQS and Process Compliance % — pulled from `v_process_compliance_summary`.
- **Downstream (effect):** Closed trade count — volume of completed executions.
- **Gate quality:** Qualified ratio — share of closed trades that entered at 100% readiness (`readiness_pct_at_entry = 100`).

Profit is intentionally absent from this strip; equity is visualized in the adjacent chart module (`equity_process_chart.md`).

---

## PrimeNG Component Table

| Component | Import Path | Role |
|-----------|-------------|------|
| `p-card` | `primeng/card` | KPI container per metric |
| `p-metergroup` | `primeng/metergroup` | Segmented bar under TQS and Compliance cards |
| `p-skeleton` | `primeng/skeleton` | Loading placeholder while Supabase resolves |
| `p-message` | `primeng/message` | Empty-state / query error banner |

---

## Layout Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dashboard — Overview Metrics                                               │
├──────────────┬──────────────┬──────────────┬──────────────────────────────┤
│  Avg TQS     │  Process     │  Trade       │  Qualified Ratio             │
│  78.4        │  Compliance  │  Count       │  94.2%                       │
│  ▓▓▓▓▓▓▓░░░  │  82.1%       │  127         │  ▓▓▓▓▓▓▓▓▓░                  │
│  p-metergroup│  p-metergroup│  (mono stat) │  p-metergroup                │
└──────────────┴──────────────┴──────────────┴──────────────────────────────┘
```

Grid: CSS Grid `repeat(4, 1fr)` on `≥992px`; `repeat(2, 1fr)` on tablet; single column on mobile.

---

## Data Layer

### Primary query — summary view

```typescript
// DashboardMetricsService — src/app/features/dashboard/services/dashboard-metrics.service.ts
import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase-client.token';

export interface ProcessComplianceSummary {
  user_id: string;
  total_closed: number;
  avg_process_compliance_pct: number | null;
  avg_tqs: number | null;
  execution_error_count: number;
  edge_failure_count: number;
}

export interface DashboardOverviewMetrics {
  avgTqs: number | null;
  avgProcessCompliancePct: number | null;
  closedTradeCount: number;
  qualifiedRatioPct: number | null;
  executionErrorCount: number;
  edgeFailureCount: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardMetricsService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  async loadOverviewMetrics(): Promise<DashboardOverviewMetrics> {
    const [summaryResult, qualifiedResult] = await Promise.all([
      this.supabase
        .from('v_process_compliance_summary')
        .select('*')
        .maybeSingle(),
      this.supabase
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'CLOSED')
        .eq('readiness_pct_at_entry', 100),
    ]);

    if (summaryResult.error) throw summaryResult.error;
    if (qualifiedResult.error) throw qualifiedResult.error;

    const summary = summaryResult.data as ProcessComplianceSummary | null;
    const totalClosed = summary?.total_closed ?? 0;
    const qualifiedCount = qualifiedResult.count ?? 0;

    return {
      avgTqs: summary?.avg_tqs ?? null,
      avgProcessCompliancePct: summary?.avg_process_compliance_pct ?? null,
      closedTradeCount: totalClosed,
      qualifiedRatioPct:
        totalClosed > 0 ? Math.round((qualifiedCount / totalClosed) * 10000) / 100 : null,
      executionErrorCount: summary?.execution_error_count ?? 0,
      edgeFailureCount: summary?.edge_failure_count ?? 0,
    };
  }
}
```

### Metric definitions

| UI Label | Source | Format | Meter Color Threshold |
|----------|--------|--------|------------------------|
| Avg TQS | `v_process_compliance_summary.avg_tqs` | `0.0` decimal, mono font | ≥80 green, 60–79 amber, <60 red |
| Process Compliance % | `avg_process_compliance_pct` | `0.0` + `%` suffix | ≥85 green, 70–84 amber, <70 red |
| Trade Count | `total_closed` | Integer, mono font | Neutral (no meter) |
| Qualified Ratio | `COUNT(trades WHERE readiness_pct_at_entry = 100) / total_closed` | `0.0` + `%` | ≥95 green, 85–94 amber, <85 red |

---

## TypeScript — Component

```typescript
// overview-metrics.component.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { MeterGroupModule } from 'primeng/metergroup';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { MeterItem } from 'primeng/api';
import {
  DashboardMetricsService,
  DashboardOverviewMetrics,
} from '../../services/dashboard-metrics.service';

@Component({
  selector: 'app-overview-metrics',
  standalone: true,
  imports: [CommonModule, CardModule, MeterGroupModule, SkeletonModule, MessageModule],
  templateUrl: './overview-metrics.component.html',
  styleUrl: './overview-metrics.component.scss',
})
export class OverviewMetricsComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly metrics = signal<DashboardOverviewMetrics | null>(null);

  readonly tqsMeters = computed(() => this.buildMeters(this.metrics()?.avgTqs));
  readonly complianceMeters = computed(() =>
    this.buildMeters(this.metrics()?.avgProcessCompliancePct),
  );
  readonly qualifiedMeters = computed(() =>
    this.buildMeters(this.metrics()?.qualifiedRatioPct),
  );

  constructor(private readonly dashboardMetrics: DashboardMetricsService) {}

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.metrics.set(await this.dashboardMetrics.loadOverviewMetrics());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      this.loading.set(false);
    }
  }

  private buildMeters(value: number | null | undefined): MeterItem[] {
    const pct = value ?? 0;
    const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
    return [
      { label: 'Score', value: pct, color },
      { label: 'Remaining', value: Math.max(0, 100 - pct), color: '#262B37' },
    ];
  }

  formatPct(value: number | null | undefined): string {
    return value == null ? '—' : `${value.toFixed(1)}%`;
  }

  formatDecimal(value: number | null | undefined): string {
    return value == null ? '—' : value.toFixed(1);
  }
}
```

---

## HTML Template

```html
<!-- overview-metrics.component.html -->
<section class="dashboard-metrics" aria-label="Dashboard overview metrics">
  @if (error(); as err) {
    <p-message severity="error" [text]="err" styleClass="dashboard-metrics__error" />
  }

  @if (loading()) {
    <div class="dashboard-metrics__grid">
      @for (i of [1, 2, 3, 4]; track i) {
        <p-card styleClass="dashboard-metrics__card">
          <p-skeleton width="40%" height="0.875rem" />
          <p-skeleton width="60%" height="2rem" styleClass="dashboard-metrics__skeleton-stat" />
          <p-skeleton width="100%" height="0.5rem" />
        </p-card>
      }
    </div>
  } @else if (metrics(); as m) {
    <div class="dashboard-metrics__grid">
      <!-- Avg TQS -->
      <p-card styleClass="dashboard-metrics__card">
        <span class="dashboard-metrics__label">Avg TQS</span>
        <span class="dashboard-metrics__value">{{ formatDecimal(m.avgTqs) }}</span>
        <p-metergroup [value]="tqsMeters()" [max]="100" />
      </p-card>

      <!-- Process Compliance -->
      <p-card styleClass="dashboard-metrics__card">
        <span class="dashboard-metrics__label">Process Compliance</span>
        <span class="dashboard-metrics__value">{{ formatPct(m.avgProcessCompliancePct) }}</span>
        <p-metergroup [value]="complianceMeters()" [max]="100" />
      </p-card>

      <!-- Trade Count -->
      <p-card styleClass="dashboard-metrics__card">
        <span class="dashboard-metrics__label">Trade Count</span>
        <span class="dashboard-metrics__value dashboard-metrics__value--count">
          {{ m.closedTradeCount }}
        </span>
        <span class="dashboard-metrics__sub">
          {{ m.executionErrorCount }} execution errors · {{ m.edgeFailureCount }} edge failures
        </span>
      </p-card>

      <!-- Qualified Ratio -->
      <p-card styleClass="dashboard-metrics__card">
        <span class="dashboard-metrics__label">Qualified Ratio</span>
        <span class="dashboard-metrics__value">{{ formatPct(m.qualifiedRatioPct) }}</span>
        <p-metergroup [value]="qualifiedMeters()" [max]="100" />
        <span class="dashboard-metrics__sub">100% readiness at entry</span>
      </p-card>
    </div>
  }
</section>
```

---

## SCSS — `.dashboard-metrics`

```scss
// overview-metrics.component.scss
.dashboard-metrics {
  margin-block-end: 1.5rem;

  &__error {
    margin-block-end: 1rem;
    width: 100%;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;

    @media (max-width: 991px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 575px) {
      grid-template-columns: 1fr;
    }
  }

  &__card {
    background: var(--dqos-bg-panel, #161920);
    border: 1px solid var(--dqos-border, #262B37);

    ::ng-deep .p-card-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem 1.25rem;
    }

    ::ng-deep .p-metergroup-meters {
      height: 0.375rem;
      border-radius: 2px;
    }
  }

  &__label {
    font-family: var(--dqos-font-ui, Inter, sans-serif);
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--p-text-muted-color, #9ca3af);
  }

  &__value {
    font-family: var(--dqos-font-mono, 'JetBrains Mono', monospace);
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1.1;
    color: var(--p-text-color, #e5e7eb);

    &--count {
      color: var(--dqos-accent-qualified, #10b981);
    }
  }

  &__sub {
    font-size: 0.6875rem;
    color: var(--p-text-muted-color, #6b7280);
  }

  &__skeleton-stat {
    margin-block: 0.5rem;
  }
}
```

---

## Parent Page Integration

```typescript
// dashboard-page.component.ts (excerpt)
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    OverviewMetricsComponent,
    EquityProcessChartComponent,
    RecentTradesComponent,
  ],
  template: `
    <div class="dashboard-page">
      <header class="dashboard-page__header">
        <h1>Dashboard</h1>
        <p class="dashboard-page__subtitle">Upstream process · Downstream outcomes</p>
      </header>
      <app-overview-metrics />
      <app-equity-process-chart />
      <app-recent-trades />
    </div>
  `,
})
export class DashboardPageComponent {}
```

Route registration in `app.routes.ts`:

```typescript
{
  path: 'dashboard',
  loadComponent: () =>
    import('./features/dashboard/dashboard-page.component').then(m => m.DashboardPageComponent),
}
```

---

## Acceptance Criteria

1. Four KPI cards render in a responsive grid without horizontal overflow on `375px` viewport.
2. Avg TQS and Process Compliance % match `v_process_compliance_summary` within rounding tolerance (`±0.01`).
3. Qualified ratio equals `qualified_closed / total_closed × 100`; displays `—` when `total_closed = 0`.
4. Skeleton loaders appear during fetch; error message replaces grid on Supabase failure.
5. Meter segments use green / amber / red thresholds defined above; remaining segment is `#262B37`.
6. Trade count sub-line shows `execution_error_count` and `edge_failure_count` from the summary view.
