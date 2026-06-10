import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageModule } from 'primeng/message';
import { PaginatorModule, type PaginatorState } from 'primeng/paginator';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { auctionStrategyShortLabel } from '../gatekeeper/auction-playbook.utils';
import { AccountScopeService } from '../../core/accounts/account-scope.service';
import { GatekeeperDraftService } from '../gatekeeper/gatekeeper-draft.service';
import type { AuctionStrategy } from '../../core/models/database.types';
import { formatJournalIdShort } from '../../shared/utils/journal-id.utils';
import { TradeLedgerService } from './trade-ledger.service';
import {
  TRADE_LEDGER_PAGE_SIZE,
  type TradeLedgerPageTotals,
  type TradeLedgerRow,
} from './trade-ledger.types';
import {
  formatLedgerMoney,
  formatLedgerPrice,
  formatLedgerVolume,
  formatMt5DateTime,
} from './trade-ledger.utils';

@Component({
  selector: 'app-trade-ledger-page',
  imports: [RouterLink, MessageModule, PaginatorModule, ProgressSpinnerModule],
  templateUrl: './trade-ledger-page.component.html',
  styleUrl: './trade-ledger-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeLedgerPageComponent implements OnInit {
  private readonly ledgerService = inject(TradeLedgerService);
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly accountScope = inject(AccountScopeService);
  private readonly router = inject(Router);

  protected readonly accountId = this.accountScope.accountId;

  protected readonly loading = signal(true);
  protected readonly openingTradeId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<TradeLedgerRow[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly page = signal(0);
  protected readonly pageSize = TRADE_LEDGER_PAGE_SIZE;

  protected readonly formatJournalId = formatJournalIdShort;
  protected readonly formatMt5DateTime = formatMt5DateTime;
  protected readonly formatLedgerPrice = formatLedgerPrice;
  protected readonly formatLedgerVolume = formatLedgerVolume;
  protected readonly formatLedgerMoney = formatLedgerMoney;

  protected formatStrategy(strategy: AuctionStrategy | null): string {
    return strategy ? auctionStrategyShortLabel(strategy) : '—';
  }

  protected readonly pageTotals = computed((): TradeLedgerPageTotals => {
    return this.rows().reduce(
      (acc, row) => ({
        commission: acc.commission + row.commission,
        fee: acc.fee + row.fee,
        swap: acc.swap + row.swap,
        profit: acc.profit + (row.profit ?? 0),
      }),
      { commission: 0, fee: 0, swap: 0, profit: 0 },
    );
  });

  protected readonly pageLabel = computed(() => {
    const total = this.totalCount();
    if (total === 0) {
      return 'No trades';
    }
    const start = this.page() * this.pageSize + 1;
    const end = Math.min(start + this.rows().length - 1, total);
    return `Showing ${start}–${end} of ${total} execution trades`;
  });

  ngOnInit(): void {
    void this.loadPage(0);
  }

  protected async openJournal(tradeId: string): Promise<void> {
    if (this.openingTradeId()) {
      return;
    }

    this.openingTradeId.set(tradeId);
    this.error.set(null);

    try {
      await this.draftService.ensureJournalForTrade(tradeId);
      const accountId = this.accountScope.accountId();
      if (!accountId) {
        return;
      }
      await this.router.navigate(['/accounts', accountId, 'gatekeeper'], {
        queryParams: { journalId: tradeId },
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not open journal');
    } finally {
      this.openingTradeId.set(null);
    }
  }

  protected onPageChange(event: PaginatorState): void {
    const nextPage = event.page ?? 0;
    if (nextPage === this.page()) {
      return;
    }
    void this.loadPage(nextPage);
  }

  private async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.ledgerService.listPage(page, this.pageSize);
      this.rows.set(result.rows);
      this.totalCount.set(result.totalCount);
      this.page.set(result.page);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load trade history');
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
