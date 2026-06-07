# 05a — Journal Dense Grid

## Module Header

| Field | Value |
|-------|-------|
| **Purpose** | High-density scrollable ledger of all closed trades with every upstream pillar column visible |
| **Angular Target Path** | `src/app/features/journal/components/dense-grid/` |
| **Route** | `/journal` (primary content of `JournalPageComponent`) |
| **Supabase Tables / Views** | `trades`, `execution_audits`, `setups` |
| **Key Metrics** | All trade outcomes + 4 pillar enums + post-mortem booleans |

---

## Philosophy

The journal is the system's source-of-truth audit trail. Unlike the dashboard's compact recent-trades widget, this grid exposes **every column** a trader needs for pattern review:

- **Frozen left columns:** `closed_at`, `symbol`, `direction` — always visible during horizontal scroll.
- **Scrollable middle:** prices, size, R, TQS, compliance, day type.
- **Scrollable right (pillars):** location, behavior, confirmation, invalidation level, four post-mortem booleans, execution_error / edge_failure flags.

Virtual scroll handles large histories (500+ trades) without DOM bloat. Row click navigates to `/trades/:id`.

---

## PrimeNG Component Table

| Component | Import Path | Role |
|-----------|-------------|------|
| `p-table` | `primeng/table` | Virtual scroll table with frozen columns |
| `p-tag` | `primeng/tag` | Direction, day type, pillar badges |
| `p-badge` | `primeng/badge` | Post-mortem pass/fail indicators |
| `p-scroller` | (built into Table virtualScroll) | Recycled row rendering |
| `p-skeleton` | `primeng/skeleton` | Initial load placeholder |
| `RouterLink` | `@angular/router` | Row navigation |

---

## Column Specification

| # | Field | Source | Frozen | Width | Format |
|---|-------|--------|--------|-------|--------|
| 1 | Closed | `trades.closed_at` | Left | 110px | `MM/dd HH:mm` mono |
| 2 | Symbol | `trades.symbol` | Left | 56px | Mono uppercase |
| 3 | Dir | `trades.direction` | Left | 64px | `p-tag` LONG=success SHORT=danger |
| 4 | Day | `trades.day_type` | — | 80px | Replace `_` → space |
| 5 | Entry | `trades.entry_price` | — | 80px | 2 decimal mono |
| 6 | Stop | `trades.stop_price` | — | 80px | 2 decimal mono |
| 7 | Exit | `trades.exit_price` | — | 80px | 2 decimal mono |
| 8 | Size | `trades.size` | — | 48px | Integer |
| 9 | R | `trades.r_multiple` | — | 72px | Signed `±X.XXR` color-coded |
| 10 | TQS | `trades.tqs` | — | 48px | Integer |
| 11 | Proc% | `trades.process_compliance_pct` | — | 56px | `XX%` |
| 12 | Setup | `setups.name` | — | 100px | Truncate 16 chars |
| 13 | Location | `execution_audits.location` | — | 100px | `p-tag` info |
| 14 | Behavior | `execution_audits.behavior` | — | 110px | `p-tag` secondary |
| 15 | Confirm | `execution_audits.confirmation` | — | 120px | `p-tag` contrast |
| 16 | Inval | `execution_audits.invalidation_level` | — | 100px | Truncate 14 chars |
| 17 | Loc✓ | `location_valid_post` | — | 40px | ✓/✗ badge |
| 18 | Beh✓ | `behavior_matched_post` | — | 40px | ✓/✗ badge |
| 19 | Con✓ | `confirmation_legitimate_post` | — | 40px | ✓/✗ badge |
| 20 | Inv✓ | `invalidation_respected_post` | — | 40px | ✓/✗ badge |
| 21 | Flags | computed | Right | 80px | EE / EF chips |

**Frozen config:** `frozenColumns` = first 3 columns; `scrollHeight` = `calc(100vh - 220px)`.

---

## Data Layer

### Journal query (filtered by parent filter builder)

```typescript
// journal-grid.service.ts
import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase-client.token';
import { JournalFilters } from '../models/journal-filters.model';

export interface JournalGridRow {
  id: string;
  closed_at: string;
  symbol: string;
  direction: string;
  day_type: string;
  entry_price: number;
  stop_price: number;
  exit_price: number;
  size: number;
  r_multiple: number;
  tqs: number | null;
  process_compliance_pct: number | null;
  setups: { name: string } | null;
  execution_audits: {
    location: string;
    behavior: string;
    confirmation: string;
    invalidation_level: string;
    location_valid_post: boolean | null;
    behavior_matched_post: boolean | null;
    confirmation_legitimate_post: boolean | null;
    invalidation_respected_post: boolean | null;
    execution_error: boolean;
    edge_failure: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class JournalGridService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  async loadRows(filters: JournalFilters): Promise<JournalGridRow[]> {
    let query = this.supabase
      .from('trades')
      .select(`
        id,
        closed_at,
        symbol,
        direction,
        day_type,
        entry_price,
        stop_price,
        exit_price,
        size,
        r_multiple,
        tqs,
        process_compliance_pct,
        setups ( name ),
        execution_audits (
          location,
          behavior,
          confirmation,
          invalidation_level,
          location_valid_post,
          behavior_matched_post,
          confirmation_legitimate_post,
          invalidation_respected_post,
          execution_error,
          edge_failure
        )
      `)
      .eq('status', 'CLOSED')
      .not('closed_at', 'is', null)
      .order('closed_at', { ascending: false });

    if (filters.symbols?.length) {
      query = query.in('symbol', filters.symbols);
    }
    if (filters.directions?.length) {
      query = query.in('direction', filters.directions);
    }
    if (filters.dayTypes?.length) {
      query = query.in('day_type', filters.dayTypes);
    }
    if (filters.dateFrom) {
      query = query.gte('closed_at', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('closed_at', filters.dateTo);
    }
    if (filters.minR != null) {
      query = query.gte('r_multiple', filters.minR);
    }
    if (filters.maxR != null) {
      query = query.lte('r_multiple', filters.maxR);
    }

    const { data, error } = await query;
    if (error) throw error;

    let rows = (data ?? []) as JournalGridRow[];

    // Client-side pillar filters (PostgREST cannot filter embedded columns in .in())
    if (filters.locations?.length) {
      rows = rows.filter(r => filters.locations!.includes(r.execution_audits.location));
    }
    if (filters.behaviors?.length) {
      rows = rows.filter(r => filters.behaviors!.includes(r.execution_audits.behavior));
    }
    if (filters.confirmations?.length) {
      rows = rows.filter(r => filters.confirmations!.includes(r.execution_audits.confirmation));
    }
    if (filters.executionErrorsOnly) {
      rows = rows.filter(r => r.execution_audits.execution_error);
    }
    if (filters.edgeFailuresOnly) {
      rows = rows.filter(r => r.execution_audits.edge_failure);
    }

    return rows;
  }
}
```

---

## TypeScript — Component

```typescript
// dense-grid.component.ts
import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { SkeletonModule } from 'primeng/skeleton';
import { JournalGridService, JournalGridRow } from '../../services/journal-grid.service';
import { JournalFilters } from '../../models/journal-filters.model';

@Component({
  selector: 'app-dense-grid',
  standalone: true,
  imports: [CommonModule, RouterLink, TableModule, TagModule, BadgeModule, SkeletonModule],
  templateUrl: './dense-grid.component.html',
  styleUrl: './dense-grid.component.scss',
})
export class DenseGridComponent implements OnChanges {
  @Input({ required: true }) filters!: JournalFilters;

  readonly loading = signal(false);
  readonly rows = signal<JournalGridRow[]>([]);
  readonly virtualScrollItemSize = 32;

  constructor(private readonly gridService: JournalGridService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters']) {
      void this.reload();
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.rows.set(await this.gridService.loadRows(this.filters));
    } finally {
      this.loading.set(false);
    }
  }

  formatR(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}R`;
  }

  formatPrice(value: number): string {
    return value.toFixed(2);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  }

  formatEnum(v: string): string {
    return v.replace(/_/g, ' ');
  }

  truncate(v: string, max: number): string {
    return v.length > max ? `${v.slice(0, max)}…` : v;
  }

  postBadge(value: boolean | null): { label: string; severity: 'success' | 'danger' | 'secondary' } {
    if (value === true) return { label: '✓', severity: 'success' };
    if (value === false) return { label: '✗', severity: 'danger' };
    return { label: '—', severity: 'secondary' };
  }
}
```

---

## HTML Template

```html
<!-- dense-grid.component.html -->
<div class="dense-grid">
  @if (loading()) {
    <p-skeleton width="100%" height="400px" />
  } @else {
    <p-table
      [value]="rows()"
      [scrollable]="true"
      scrollHeight="calc(100vh - 220px)"
      [virtualScroll]="true"
      [virtualScrollItemSize]="virtualScrollItemSize"
      styleClass="dense-grid__table p-datatable-sm"
      [rowHover]="true"
    >
      <!-- Frozen header -->
      <ng-template pTemplate="frozenheader">
        <tr>
          <th style="width:110px">Closed</th>
          <th style="width:56px">Sym</th>
          <th style="width:64px">Dir</th>
        </tr>
      </ng-template>

      <!-- Scrollable header -->
      <ng-template pTemplate="header">
        <tr>
          <th style="width:110px">Closed</th>
          <th style="width:56px">Sym</th>
          <th style="width:64px">Dir</th>
          <th style="width:80px">Day</th>
          <th style="width:80px">Entry</th>
          <th style="width:80px">Stop</th>
          <th style="width:80px">Exit</th>
          <th style="width:48px">Sz</th>
          <th style="width:72px">R</th>
          <th style="width:48px">TQS</th>
          <th style="width:56px">Proc%</th>
          <th style="width:100px">Setup</th>
          <th style="width:100px">Location</th>
          <th style="width:110px">Behavior</th>
          <th style="width:120px">Confirm</th>
          <th style="width:100px">Inval</th>
          <th style="width:40px">Loc</th>
          <th style="width:40px">Beh</th>
          <th style="width:40px">Con</th>
          <th style="width:40px">Inv</th>
          <th style="width:80px">Flags</th>
        </tr>
      </ng-template>

      <!-- Frozen body -->
      <ng-template pTemplate="frozenbody" let-row>
        <tr
          class="dense-grid__row"
          [routerLink]="['/trades', row.id]"
          tabindex="0"
        >
          <td class="dense-grid__mono dense-grid__date">{{ formatDate(row.closed_at) }}</td>
          <td class="dense-grid__mono dense-grid__symbol">{{ row.symbol }}</td>
          <td>
            <p-tag
              [value]="row.direction"
              [severity]="row.direction === 'LONG' ? 'success' : 'danger'"
              styleClass="dense-grid__dir-tag"
            />
          </td>
        </tr>
      </ng-template>

      <!-- Scrollable body -->
      <ng-template pTemplate="body" let-row>
        <tr
          class="dense-grid__row"
          [routerLink]="['/trades', row.id]"
          tabindex="0"
        >
          <td class="dense-grid__mono dense-grid__date">{{ formatDate(row.closed_at) }}</td>
          <td class="dense-grid__mono dense-grid__symbol">{{ row.symbol }}</td>
          <td>
            <p-tag
              [value]="row.direction"
              [severity]="row.direction === 'LONG' ? 'success' : 'danger'"
              styleClass="dense-grid__dir-tag"
            />
          </td>
          <td class="dense-grid__day">{{ formatEnum(row.day_type) }}</td>
          <td class="dense-grid__mono">{{ formatPrice(row.entry_price) }}</td>
          <td class="dense-grid__mono">{{ formatPrice(row.stop_price) }}</td>
          <td class="dense-grid__mono">{{ formatPrice(row.exit_price) }}</td>
          <td class="dense-grid__mono">{{ row.size }}</td>
          <td
            class="dense-grid__mono dense-grid__r"
            [class.dense-grid__r--win]="row.r_multiple >= 0"
            [class.dense-grid__r--loss]="row.r_multiple < 0"
          >
            {{ formatR(row.r_multiple) }}
          </td>
          <td class="dense-grid__mono">{{ row.tqs ?? '—' }}</td>
          <td class="dense-grid__mono">
            {{ row.process_compliance_pct != null ? row.process_compliance_pct.toFixed(0) + '%' : '—' }}
          </td>
          <td>{{ row.setups?.name ? truncate(row.setups.name, 16) : '—' }}</td>
          <td><p-tag [value]="formatEnum(row.execution_audits.location)" severity="info" styleClass="dense-grid__pillar" /></td>
          <td><p-tag [value]="row.execution_audits.behavior" severity="secondary" styleClass="dense-grid__pillar" /></td>
          <td><p-tag [value]="formatEnum(row.execution_audits.confirmation)" severity="contrast" styleClass="dense-grid__pillar" /></td>
          <td>{{ truncate(row.execution_audits.invalidation_level, 14) }}</td>
          <td><p-badge [value]="postBadge(row.execution_audits.location_valid_post).label" [severity]="postBadge(row.execution_audits.location_valid_post).severity" /></td>
          <td><p-badge [value]="postBadge(row.execution_audits.behavior_matched_post).label" [severity]="postBadge(row.execution_audits.behavior_matched_post).severity" /></td>
          <td><p-badge [value]="postBadge(row.execution_audits.confirmation_legitimate_post).label" [severity]="postBadge(row.execution_audits.confirmation_legitimate_post).severity" /></td>
          <td><p-badge [value]="postBadge(row.execution_audits.invalidation_respected_post).label" [severity]="postBadge(row.execution_audits.invalidation_respected_post).severity" /></td>
          <td class="dense-grid__flags">
            @if (row.execution_audits.execution_error) {
              <span class="dense-grid__flag dense-grid__flag--ee">EE</span>
            }
            @if (row.execution_audits.edge_failure) {
              <span class="dense-grid__flag dense-grid__flag--ef">EF</span>
            }
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr>
          <td colspan="21" class="dense-grid__empty">No trades match current filters.</td>
        </tr>
      </ng-template>
    </p-table>

    <footer class="dense-grid__footer">
      {{ rows().length }} trade{{ rows().length === 1 ? '' : 's' }}
    </footer>
  }
</div>
```

---

## SCSS — High Density Styling

```scss
// dense-grid.component.scss
.dense-grid {
  &__table {
    ::ng-deep .p-datatable-table {
      font-size: 0.75rem;
      table-layout: fixed;
    }

    ::ng-deep .p-datatable-thead > tr > th {
      padding: 0.3125rem 0.5rem;
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--p-text-muted-color, #6b7280);
      background: var(--dqos-bg-panel, #161920);
      border-color: var(--dqos-border, #262B37);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    ::ng-deep .p-datatable-tbody > tr > td {
      padding: 0.25rem 0.5rem;
      height: 32px;
      line-height: 1.2;
      border-color: var(--dqos-border, #262B37);
      vertical-align: middle;
    }

    ::ng-deep .p-datatable-frozen-tbody,
    ::ng-deep .p-datatable-frozen-thead {
      background: var(--dqos-bg-panel, #161920);
      box-shadow: 4px 0 8px rgba(0, 0, 0, 0.25);
    }

    ::ng-deep .p-virtualscroller {
      contain: strict;
    }
  }

  &__row {
    cursor: pointer;

    &:hover {
      background: var(--p-content-hover-background, #1a1d24);
    }
  }

  &__mono {
    font-family: var(--dqos-font-mono, 'JetBrains Mono', monospace);
    font-size: 0.6875rem;
  }

  &__date {
    color: var(--p-text-muted-color, #9ca3af);
  }

  &__symbol {
    font-weight: 600;
  }

  &__r {
    font-weight: 600;

    &--win { color: var(--dqos-accent-qualified, #10b981); }
    &--loss { color: #ef4444; }
  }

  &__day {
    font-size: 0.6875rem;
    color: var(--p-text-muted-color, #9ca3af);
  }

  &__dir-tag,
  &__pillar {
    font-size: 0.5625rem;
    padding: 0.0625rem 0.25rem;
  }

  &__flags {
    display: flex;
    gap: 0.25rem;
  }

  &__flag {
    font-family: var(--dqos-font-mono, 'JetBrains Mono', monospace);
    font-size: 0.5625rem;
    font-weight: 700;
    padding: 0.0625rem 0.25rem;
    border-radius: 2px;

    &--ee {
      background: rgba(245, 158, 11, 0.15);
      color: var(--dqos-accent-warning, #f59e0b);
    }

    &--ef {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }
  }

  &__footer {
    padding: 0.5rem 0.75rem;
    font-size: 0.6875rem;
    color: var(--p-text-muted-color, #6b7280);
    border-top: 1px solid var(--dqos-border, #262B37);
  }

  &__empty {
    text-align: center;
    padding: 3rem;
    color: var(--p-text-muted-color, #6b7280);
  }
}
```

---

## Parent Page Integration

```typescript
// journal-page.component.ts
@Component({
  selector: 'app-journal-page',
  standalone: true,
  imports: [QueryFilterBuilderComponent, DenseGridComponent],
  template: `
    <div class="journal-page">
      <header class="journal-page__header">
        <h1>Journal</h1>
      </header>
      <app-query-filter-builder [(filters)]="filters" />
      <app-dense-grid [filters]="filters" />
    </div>
  `,
})
export class JournalPageComponent {
  filters: JournalFilters = DEFAULT_JOURNAL_FILTERS;
}
```

Route:

```typescript
{
  path: 'journal',
  loadComponent: () =>
    import('./features/journal/journal-page.component').then(m => m.JournalPageComponent),
}
```

---

## Acceptance Criteria

1. Virtual scroll renders 32px row height; table scrolls vertically to `calc(100vh - 220px)` without page scroll.
2. First three columns (Closed, Sym, Dir) remain frozen during horizontal scroll.
3. All 21 columns visible via horizontal scroll; no column hidden behind responsive breakpoints.
4. Row height ≤ 32px; font size ≤ 0.75rem body / 0.625rem headers.
5. Grid reloads when parent `filters` input changes (via `QueryFilterBuilderComponent`).
6. EE and EF flags render only when `execution_error` or `edge_failure` is true.
7. Row click navigates to `/trades/:id`; footer shows filtered row count.
