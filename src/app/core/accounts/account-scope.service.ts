import { Injectable, inject, signal } from '@angular/core';

import { GatekeeperDraftService } from '../../features/gatekeeper/gatekeeper-draft.service';
import { TradeLedgerService } from '../../features/trade-ledger/trade-ledger.service';
import { TradingAccountService } from './trading-account.service';

@Injectable({ providedIn: 'root' })
export class AccountScopeService {
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly ledgerService = inject(TradeLedgerService);
  private readonly accountService = inject(TradingAccountService);

  private readonly accountIdSignal = signal<string | null>(null);

  readonly accountId = this.accountIdSignal.asReadonly();

  async bind(accountId: string): Promise<void> {
    if (this.accountIdSignal() === accountId) {
      await this.accountService.getAccount(accountId);
      return;
    }

    this.draftService.clearActive();
    this.draftService.bindAccount(accountId);
    this.ledgerService.bindAccount(accountId);
    this.accountIdSignal.set(accountId);
    await this.accountService.getAccount(accountId);
  }

  clear(): void {
    this.draftService.clearActive();
    this.draftService.bindAccount(null);
    this.ledgerService.bindAccount(null);
    this.accountIdSignal.set(null);
    this.accountService.setActiveAccount(null);
  }
}
