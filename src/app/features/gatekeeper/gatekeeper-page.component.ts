import { ChangeDetectionStrategy, Component, AfterViewInit, inject, signal, viewChild } from '@angular/core';
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
  private readonly wizardRef = viewChild(GatekeeperWizardComponent);
  private readonly executionRef = viewChild(ExecutionBlockComponent);

  private sessionLoadToken = 0;
  private pendingSession: TradingSessionState | null = null;

  protected readonly pillarSteps = signal<PillarStepState[]>([]);
  protected readonly pillarsQualified = signal(false);
  protected readonly readinessPct = signal(0);
  protected readonly qualifiedFormValue = signal<GatekeeperFormValue | null>(null);
  protected readonly isRetest = signal(false);
  protected readonly sessionState = signal<TradingSessionState | null>(null);
  protected readonly sessionValid = signal(false);

  ngAfterViewInit(): void {
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
      this.draftService.clearActive();
      this.wizardRef()?.resetWizard();
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
    this.executionRef()?.resetExecutionForm();
    this.pillarSteps.set([]);
    this.pillarsQualified.set(false);
    this.readinessPct.set(0);
    this.qualifiedFormValue.set(null);
    this.isRetest.set(false);
  }

  private async restoreDraftForSession(state: TradingSessionState): Promise<void> {
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

      await wizard.loadFromDraft(result);

      if (result.restored) {
        this.messageService.add({
          severity: 'info',
          summary: 'Draft restored',
          detail: 'Your in-progress Gatekeeper session was loaded from the cloud.',
          life: 4000,
        });
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
