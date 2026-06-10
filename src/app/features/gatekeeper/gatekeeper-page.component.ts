import {
  ChangeDetectionStrategy,
  Component,
  AfterViewInit,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ReadinessMeterComponent } from '../../shared/components/readiness-meter/readiness-meter.component';
import {
  readinessPctFromCompleted,
  type PillarStepState,
} from '../../shared/components/readiness-meter/readiness-meter.types';
import { RiskRewardCalculatorComponent } from './risk-reward-calculator/risk-reward-calculator.component';
import { AccountRiskService } from '../../core/accounts/account-risk.service';
import { AccountScopeService } from '../../core/accounts/account-scope.service';
import { TradingAccountService } from '../../core/accounts/trading-account.service';
import { AccountRiskBannerComponent } from '../../shared/components/account-risk-banner/account-risk-banner.component';
import { PageSkeletonComponent } from '../../shared/components/page-skeleton/page-skeleton.component';
import { GatekeeperDraftService } from './gatekeeper-draft.service';
import { GatekeeperWizardComponent } from './gatekeeper-wizard.component';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import type { GatekeeperSubmitResult } from './execution-block.types';
import type { TradingSessionState } from './trading-session.types';
import { TradingSessionBarComponent } from './trading-session-bar.component';

@Component({
  selector: 'app-gatekeeper-page',
  imports: [
    AccountRiskBannerComponent,
    PageSkeletonComponent,
    TradingSessionBarComponent,
    GatekeeperWizardComponent,
    ReadinessMeterComponent,
    MessageModule,
    ToastModule,
    RiskRewardCalculatorComponent,
  ],
  templateUrl: './gatekeeper-page.component.html',
  styleUrl: './gatekeeper-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
})
export class GatekeeperPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly messageService = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountScope = inject(AccountScopeService);
  private readonly accountService = inject(TradingAccountService);
  private readonly riskService = inject(AccountRiskService);

  protected readonly accountId = this.accountScope.accountId;
  protected readonly booting = signal(true);
  private readonly sessionBarRef = viewChild(TradingSessionBarComponent);
  private readonly wizardRef = viewChild(GatekeeperWizardComponent);

  private sessionLoadToken = 0;
  private pendingSession: TradingSessionState | null = null;
  private resumeJournalId: string | null = null;
  /** Tracks which saved journal is open via ?journalId= (null = fresh session). */
  private activeJournalId: string | null = null;
  private viewsReady = false;
  private routeSub: { unsubscribe(): void } | null = null;
  /** Prevents re-init when session bar re-emits after draft hydrate. */
  private sessionDraftLoadKey: string | null = null;

  protected readonly pillarSteps = signal<PillarStepState[]>([]);
  protected readonly pillarsQualified = signal(false);
  protected readonly readinessPct = signal(0);
  protected readonly qualifiedFormValue = signal<GatekeeperFormValue | null>(null);
  protected readonly isRetest = signal(false);
  protected readonly sessionState = signal<TradingSessionState | null>(null);
  protected readonly sessionValid = signal(false);

  async ngOnInit(): Promise<void> {
    const accountId = this.accountScope.accountId();
    if (accountId) {
      await this.accountService.getAccount(accountId);
      await this.riskService.evaluate(accountId);
    }
    this.booting.set(false);

    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      if (!this.viewsReady) {
        return;
      }
      void this.syncRouteState(params.get('journalId'));
    });
  }

  ngAfterViewInit(): void {
    this.viewsReady = true;
    void this.syncRouteState(this.route.snapshot.queryParamMap.get('journalId'));

    if (this.pendingSession) {
      void this.ensureDraftForSession(this.pendingSession);
      this.pendingSession = null;
    }
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  protected onSessionChange(event: { valid: boolean; state: TradingSessionState | null }): void {
    this.sessionValid.set(event.valid);
    this.sessionState.set(event.state);
    this.draftService.bindSession(event.valid ? event.state : null);

    if (!event.valid || !event.state) {
      this.sessionLoadToken += 1;
      this.sessionDraftLoadKey = null;
      if (!this.resumeJournalId) {
        this.draftService.clearActive();
        this.wizardRef()?.resetWizard();
      }
      return;
    }

    if (this.resumeJournalId) {
      return;
    }

    void this.ensureDraftForSession(event.state);
  }

  protected onPillarsChange(event: {
    pillarSteps: PillarStepState[];
    pillarsQualified: boolean;
    isRetest: boolean;
    formValue: GatekeeperFormValue | null;
  }): void {
    this.pillarSteps.set(event.pillarSteps);
    this.pillarsQualified.set(event.pillarsQualified);
    this.readinessPct.set(readinessPctFromCompleted(event.pillarSteps.filter((step) => step.valid).length));
    this.qualifiedFormValue.set(event.formValue);
    this.isRetest.set(event.isRetest);
  }

  protected async onTradeSubmitted(_result: GatekeeperSubmitResult): Promise<void> {
    const journalName = this.sessionState()?.journalName;
    this.wizardRef()?.resetWizard();
    this.sessionBarRef()?.resetForNewJournal();
    this.sessionState.set(null);
    this.sessionValid.set(false);
    this.pillarSteps.set([]);
    this.pillarsQualified.set(false);
    this.readinessPct.set(0);
    this.qualifiedFormValue.set(null);
    this.isRetest.set(false);
    this.activeJournalId = null;
    this.resumeJournalId = null;
    this.sessionDraftLoadKey = null;
    this.messageService.add({
      severity: 'success',
      summary: 'Journal saved',
      detail: journalName
        ? `"${journalName}" is in your journal list.`
        : 'Your completed journal is in the journal list.',
      life: 5000,
    });
    this.navigateToSection('journal');
  }

  private navigateToSection(segment: string, queryParams?: Record<string, string>): void {
    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }
    void this.router.navigate(['/accounts', accountId, segment], { queryParams });
  }

  private async syncRouteState(journalId: string | null): Promise<void> {
    if (journalId) {
      if (this.activeJournalId === journalId && this.draftService.activeDraftId() === journalId) {
        return;
      }

      this.activeJournalId = journalId;
      this.resumeJournalId = journalId;
      await this.openJournalById(journalId);
      return;
    }

    this.activeJournalId = null;
    this.resumeJournalId = null;
    this.beginFreshJournal();
  }

  private beginFreshJournal(): void {
    this.sessionLoadToken += 1;
    this.sessionDraftLoadKey = null;
    this.draftService.clearActive();
    this.sessionState.set(null);
    this.sessionValid.set(false);
    this.pillarSteps.set([]);
    this.pillarsQualified.set(false);
    this.readinessPct.set(0);
    this.qualifiedFormValue.set(null);
    this.isRetest.set(false);
    this.wizardRef()?.resetWizard();
    this.sessionBarRef()?.resetForNewJournal();
  }

  private async openJournalById(journalId: string): Promise<void> {
    const token = ++this.sessionLoadToken;

    try {
      const result = await this.draftService.initById(journalId);
      if (token !== this.sessionLoadToken) {
        return;
      }

      this.sessionState.set({
        journalName: result.journalName,
        session: result.sessionContext,
        symbol: result.symbol,
      });
      this.sessionValid.set(true);

      const sessionBar = this.sessionBarRef();
      const wizard = this.wizardRef();
      sessionBar?.applyLoadedDraft(result);
      if (wizard) {
        await wizard.loadFromDraft(result);
      }

      this.sessionDraftLoadKey = result.journalName.trim();

      this.messageService.add({
        severity: 'info',
        summary: 'Journal opened',
        detail: `"${result.journalName}" loaded at step ${result.uiState.active_step}.`,
        life: 4000,
      });
    } catch (err) {
      if (token !== this.sessionLoadToken) {
        return;
      }

      const message = err instanceof Error ? err.message : 'Could not open journal';
      this.messageService.add({
        severity: 'warn',
        summary: 'Journal unavailable',
        detail: message,
        life: 6000,
      });
      this.navigateToSection('journal');
    }
  }

  private async ensureDraftForSession(state: TradingSessionState): Promise<void> {
    const loadKey = state.journalName.trim();
    if (this.sessionDraftLoadKey === loadKey && this.draftService.activeDraftId()) {
      return;
    }

    const token = ++this.sessionLoadToken;

    try {
      const result = await this.draftService.initForSession(state);
      if (token !== this.sessionLoadToken) {
        return;
      }

      const wizard = this.wizardRef();

      if (!wizard) {
        this.pendingSession = state;
        return;
      }

      this.sessionDraftLoadKey = loadKey;
      await wizard.loadFromDraft(result);
    } catch (err) {
      if (token !== this.sessionLoadToken) {
        return;
      }

      const message = err instanceof Error ? err.message : 'Could not load draft';
      this.messageService.add({
        severity: 'warn',
        summary: 'Draft unavailable',
        detail: message,
        life: 6000,
      });
    }
  }
}
