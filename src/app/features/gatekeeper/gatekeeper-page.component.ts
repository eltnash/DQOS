import {
  ChangeDetectionStrategy,
  Component,
  AfterViewInit,
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
import { ExecutionBlockComponent } from './execution-block.component';
import { GatekeeperDraftService } from './gatekeeper-draft.service';
import { GatekeeperWizardComponent } from './gatekeeper-wizard.component';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import type { GatekeeperSubmitResult } from './execution-block.types';
import type { TradingSessionState } from './trading-session.types';
import { TradingSessionBarComponent } from './trading-session-bar.component';

@Component({
  selector: 'app-gatekeeper-page',
  imports: [
    TradingSessionBarComponent,
    GatekeeperWizardComponent,
    ReadinessMeterComponent,
    ExecutionBlockComponent,
    MessageModule,
    ToastModule,
  ],
  templateUrl: './gatekeeper-page.component.html',
  styleUrl: './gatekeeper-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
})
export class GatekeeperPageComponent implements AfterViewInit {
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly messageService = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessionBarRef = viewChild(TradingSessionBarComponent);
  private readonly wizardRef = viewChild(GatekeeperWizardComponent);
  private readonly executionRef = viewChild(ExecutionBlockComponent);

  private sessionLoadToken = 0;
  private pendingSession: TradingSessionState | null = null;
  private resumeJournalId: string | null = null;

  protected readonly pillarSteps = signal<PillarStepState[]>([]);
  protected readonly pillarsQualified = signal(false);
  protected readonly readinessPct = signal(0);
  protected readonly qualifiedFormValue = signal<GatekeeperFormValue | null>(null);
  protected readonly isRetest = signal(false);
  protected readonly sessionState = signal<TradingSessionState | null>(null);
  protected readonly sessionValid = signal(false);

  constructor() {
    this.resumeJournalId = this.route.snapshot.queryParamMap.get('journalId');
  }

  ngAfterViewInit(): void {
    if (this.resumeJournalId) {
      void this.openJournalById(this.resumeJournalId);
      return;
    }

    if (this.pendingSession) {
      void this.restoreDraftForSession(this.pendingSession);
      this.pendingSession = null;
    }
  }

  protected onSessionChange(event: { valid: boolean; state: TradingSessionState | null }): void {
    this.sessionValid.set(event.valid);
    this.sessionState.set(event.state);
    this.draftService.bindSession(event.valid ? event.state : null);

    if (!event.valid || !event.state) {
      this.sessionLoadToken += 1;
      if (!this.resumeJournalId) {
        this.draftService.clearActive();
        this.wizardRef()?.resetWizard();
      }
      return;
    }

    if (this.resumeJournalId) {
      return;
    }

    void this.restoreDraftForSession(event.state);
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
    await this.draftService.deleteActiveDraft();
    this.wizardRef()?.resetWizard();
    this.sessionBarRef()?.resetForNewJournal();
    this.executionRef()?.resetExecutionForm();
    this.pillarSteps.set([]);
    this.pillarsQualified.set(false);
    this.readinessPct.set(0);
    this.qualifiedFormValue.set(null);
    this.isRetest.set(false);
    this.resumeJournalId = null;
    void this.router.navigate(['/gatekeeper']);
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
      void this.router.navigate(['/journal']);
    }
  }

  private async restoreDraftForSession(state: TradingSessionState): Promise<void> {
    const token = ++this.sessionLoadToken;

    try {
      const result = await this.draftService.initForSession(state);
      if (token !== this.sessionLoadToken) {
        return;
      }

      const sessionBar = this.sessionBarRef();
      const wizard = this.wizardRef();

      if (!wizard) {
        this.pendingSession = state;
        return;
      }

      if (result.restored) {
        sessionBar?.applyLoadedDraft(result);
        await wizard.loadFromDraft(result);
        this.messageService.add({
          severity: 'info',
          summary: 'Journal restored',
          detail: `"${result.journalName}" resumed at step ${result.uiState.active_step}.`,
          life: 4000,
        });
      } else {
        sessionBar?.applyLoadedDraft(result);
        await wizard.loadFromDraft(result);
      }
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
