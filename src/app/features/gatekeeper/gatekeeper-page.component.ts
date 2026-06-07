import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';

import { ReadinessMeterComponent } from '../../shared/components/readiness-meter/readiness-meter.component';
import {
  readinessPctFromCompleted,
  type PillarStepState,
} from '../../shared/components/readiness-meter/readiness-meter.types';
import { ExecutionBlockComponent } from './execution-block.component';
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
})
export class GatekeeperPageComponent {
  private readonly wizardRef = viewChild(GatekeeperWizardComponent);
  private readonly executionRef = viewChild(ExecutionBlockComponent);

  protected readonly pillarSteps = signal<PillarStepState[]>([]);
  protected readonly pillarsQualified = signal(false);
  protected readonly readinessPct = signal(0);
  protected readonly qualifiedFormValue = signal<GatekeeperFormValue | null>(null);
  protected readonly isRetest = signal(false);
  protected readonly sessionState = signal<TradingSessionState | null>(null);
  protected readonly sessionValid = signal(false);

  protected onSessionChange(event: { valid: boolean; state: TradingSessionState | null }): void {
    this.sessionValid.set(event.valid);
    this.sessionState.set(event.state);
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

  protected onTradeSubmitted(_result: GatekeeperSubmitResult): void {
    this.wizardRef()?.resetWizard();
    this.executionRef()?.resetExecutionForm();
    this.pillarSteps.set([]);
    this.pillarsQualified.set(false);
    this.readinessPct.set(0);
    this.qualifiedFormValue.set(null);
    this.isRetest.set(false);
  }
}
