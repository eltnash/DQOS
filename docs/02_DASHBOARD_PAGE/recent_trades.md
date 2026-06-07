# 02c — Dashboard Recent Trades Table

## Module Header

| Field | Value |
|-------|-------|
| **Purpose** | Quick-scan list of the 10 most recently closed trades with upstream pillar context |
| **Angular Target Path** | `src/app/features/dashboard/components/recent-trades/` |
| **Route** | `/dashboard` (bottom section of `DashboardPageComponent`) |
| **Supabase Tables / Views** | `trades`, `execution_audits` |
| **Key Metrics** | R-multiple, TQS, pillar enums (Location, Behavior, Confirmation) |

---

## Philosophy

Recent trades bridge the dashboard KPI strip and the full journal ledger. Each row shows:

- **Downstream:** symbol, direction, R-multiple, closed date.
- **Upstream:** four pillar values as compact `p-tag` badges sourced from the joined `execution_audits` row.

Every row links to `/trades/:id` for post-mortem detail. Only `CLOSED` trades appear; open and draft trades are excluded.

---

## PrimeNG Component Table

| Component | Import Path | Role |
|-----------|-------------|------|
| `p-table` | `primeng/table` | Compact data grid (`size="small"`) |
| `p-tag` | `primeng/tag` | Pillar enum badges with severity color map |
| `p-button` | `primeng/button` | "View all" link to `/journal` |
| `p-skeleton` | `primeng/skeleton` | Row placeholders during load |
| `RouterLink` | `@angular/router` | Row navigation to trade detail |

---

## Data Layer

### Supabase query with join

```typescript
// recent-trades.service.ts
import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase-client.token';
import {
  AssetSymbol,
  TradeDirection,
  AuctionLocation,
  MarketBehavior,
  ConfirmationTrigger,
} from '../../../core/models/trade.types';

export interface RecentTradeRow {
  id: string;
  symbol: AssetSymbol;
  direction: TradeDirection;
  closed_at: string;
  r_multiple: number;
  tqs: number | null;
  process_compliance_pct: number | null;
  execution_audits: {
    location: AuctionLocation;
    behavior: MarketBehavior;
    confirmation: ConfirmationTrigger;
    invalidation_level: string;
    execution_error: boolean;
    edge_failure: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class RecentTradesService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly limit = 10;

  async loadRecentClosed(): Promise<RecentTradeRow[]> {
    const { data, error } = await this.supabase
      .from('trades')
      .select(`
        id,
        symbol,
        direction,
        closed_at,
        r_multiple,
        tqs,
        process_compliance_pct,
        execution_audits (
          location,
          behavior,
          confirmation,
          invalidation_level,
          execution_error,
          edge_failure
        )
      `)
      .eq('status', 'CLOSED')
      .not('closed_at', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(this.limit);

    if (error) throw error;
    return (data ?? []) as RecentTradeRow[];
  }
}
```

PostgREST returns `execution_audits` as an object (1:1 FK) when using the embedded select syntax above.

---

## Pillar Tag Severity Map

| Pillar | Enum Source | Tag Severity | Display Transform |
|--------|-------------|--------------|-------------------|
| Location | `execution_audits.location` | `info` | Replace `_` with space |
| Behavior | `execution_audits.behavior` | `secondary` | As stored |
| Confirmation | `execution_audits.confirmation` | `contrast` | Replace `_` with space |
| Invalidation | `execution_audits.invalidation_level` | `warn` | Truncate to 20 chars + `…` if longer |

Row-level flags:

| Condition | Row Class | R-multiple Color |
|-----------|-----------|------------------|
| `execution_error = true` | `.recent-trades__row--exec-error` | Green text + amber left border |
| `edge_failure = true` | `.recent-trades__row--edge-failure` | Red text + red left border |
| `r_multiple >= 0` (default) | — | `#10b981` |
| `r_multiple < 0` | — | `#ef4444` |

---

## TypeScript — Component

```typescript
// recent-trades.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { RecentTradesService, RecentTradeRow } from '../../services/recent-trades.service';

@Component({
  selector: 'app-recent-trades',
  standalone: true,
  imports: [CommonModule, RouterLink, TableModule, TagModule, ButtonModule, SkeletonModule],
  templateUrl: './recent-trades.component.html',
  styleUrl: './recent-trades.component.scss',
})
export class RecentTradesComponent implements OnInit {
  readonly loading = signal(true);
  readonly rows = signal<RecentTradeRow[]>([]);

  constructor(private readonly recentTrades: RecentTradesService) {}

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.rows.set(await this.recentTrades.loadRecentClosed());
    } finally {
      this.loading.set(false);
    }
  }

  formatR(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}R`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatEnum(value: string): string {
    return value.replace(/_/g, ' ');
  }

  truncate(text: string, max = 20): string {
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  rowClass(row: RecentTradeRow): Record<string, boolean> {
    const audit = row.execution_audits;
    return {
      'recent-trades__row--exec-error': audit.execution_error,
      'recent-trades__row--edge-failure': audit.edge_failure,
    };
  }

  rClass(value: number): string {
    return value >= 0 ? 'recent-trades__r--win' : 'recent-trades__r--loss';
  }
}
```

---

## HTML Template

```html
<!-- recent-trades.component.html -->
<section class="recent-trades">
  <div class="recent-trades__header">
    <h2 class="recent-trades__title">Recent Trades</h2>
    <a pButton routerLink="/journal" label="View all" class="p-button-text p-button-sm" />
  </div>

  @if (loading()) {
    <p-table [value]="[1, 2, 3, 4, 5]" styleClass="recent-trades__table">
      <ng-template pTemplate="body">
        <tr><td colspan="6"><p-skeleton width="100%" height="1.5rem" /></td></tr>
      </ng-template>
    </p-table>
  } @else {
    <p-table
      [value]="rows()"
      styleClass="recent-trades__table p-datatable-sm"
      [rowHover]="true"
    >
      <ng-template pTemplate="header">
        <tr>
          <th>Closed</th>
          <th>Symbol</th>
          <th>Dir</th>
          <th>R</th>
          <th>TQS</th>
          <th>Pillars</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-row>
        <tr
          [class]="rowClass(row)"
          class="recent-trades__row"
          [routerLink]="['/trades', row.id]"
          tabindex="0"
          role="link"
        >
          <td class="recent-trades__date">{{ formatDate(row.closed_at) }}</td>
          <td class="recent-trades__symbol">{{ row.symbol }}</td>
          <td>
            <p-tag
              [value]="row.direction"
              [severity]="row.direction === 'LONG' ? 'success' : 'danger'"
            />
          </td>
          <td [class]="rClass(row.r_multiple)" class="recent-trades__r">
            {{ formatR(row.r_multiple) }}
          </td>
          <td class="recent-trades__tqs">
            {{ row.tqs != null ? row.tqs.toFixed(0) : '—' }}
          </td>
          <td class="recent-trades__pillars">
            <p-tag
              [value]="formatEnum(row.execution_audits.location)"
              severity="info"
              styleClass="recent-trades__pillar-tag"
            />
            <p-tag
              [value]="row.execution_audits.behavior"
              severity="secondary"
              styleClass="recent-trades__pillar-tag"
            />
            <p-tag
              [value]="formatEnum(row.execution_audits.confirmation)"
              severity="contrast"
              styleClass="recent-trades__pillar-tag"
            />
            <p-tag
              [value]="truncate(row.execution_audits.invalidation_level)"
              severity="warn"
              styleClass="recent-trades__pillar-tag"
            />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr>
          <td colspan="6" class="recent-trades__empty">No closed trades yet.</td>
        </tr>
      </ng-template>
    </p-table>
  }
</section>
```

---

## SCSS

```scss
// recent-trades.component.scss
.recent-trades {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-block-end: 0.75rem;
  }

  &__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  &__table {
    ::ng-deep .p-datatable-table {
      font-size: 0.8125rem;
    }

    ::ng-deep .p-datatable-thead > tr > th {
      padding: 0.5rem 0.75rem;
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--p-text-muted-color, #6b7280);
      background: var(--dqos-bg-panel, #161920);
      border-color: var(--dqos-border, #262B37);
    }

    ::ng-deep .p-datatable-tbody > tr > td {
      padding: 0.4375rem 0.75rem;
      border-color: var(--dqos-border, #262B37);
    }
  }

  &__row {
    cursor: pointer;

    &:hover {
      background: var(--p-content-hover-background, #1a1d24);
    }

    &--exec-error {
      border-left: 3px solid var(--dqos-accent-warning, #f59e0b);
    }

    &--edge-failure {
      border-left: 3px solid #ef4444;
    }
  }

  &__date {
    font-size: 0.75rem;
    color: var(--p-text-muted-color, #9ca3af);
    white-space: nowrap;
  }

  &__symbol {
    font-family: var(--dqos-font-mono, 'JetBrains Mono', monospace);
    font-weight: 600;
  }

  &__r {
    font-family: var(--dqos-font-mono, 'JetBrains Mono', monospace);
    font-weight: 600;

    &--win { color: var(--dqos-accent-qualified, #10b981); }
    &--loss { color: #ef4444; }
  }

  &__tqs {
    font-family: var(--dqos-font-mono, 'JetBrains Mono', monospace);
  }

  &__pillars {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  &__pillar-tag {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
  }

  &__empty {
    text-align: center;
    padding: 2rem;
    color: var(--p-text-muted-color, #6b7280);
  }
}
```

---

## Route Target

Trade detail route (consumed by row click):

```typescript
{
  path: 'trades/:id',
  loadComponent: () =>
    import('./features/trade-details/trade-details-page.component')
      .then(m => m.TradeDetailsPageComponent),
}
```

---

## Acceptance Criteria

1. Table displays exactly 10 rows (or fewer if user has <10 closed trades), ordered by `closed_at DESC`.
2. Each row navigates to `/trades/:id` on click or Enter key.
3. All four pillar values render as `p-tag` badges without wrapping beyond two lines at `992px` width.
4. `execution_error` rows show amber left border; `edge_failure` rows show red left border.
5. R-multiple formatted as signed decimal with `R` suffix (e.g. `+1.50R`, `-0.75R`).
6. "View all" button routes to `/journal`.
7. Join to `execution_audits` is mandatory — trades without audit rows must not appear (enforced by DB 1:1 constraint).
