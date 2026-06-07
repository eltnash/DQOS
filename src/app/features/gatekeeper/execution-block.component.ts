import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DividerModule } from 'primeng/divider';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';

import { GatekeeperSubmitService } from './gatekeeper-submit.service';
import {
  DAY_TYPE_OPTIONS,
  TRADE_DIRECTION_OPTIONS,
} from '../../core/supabase/enum-options';
import { createExecutionForm } from './execution-form.factory';
import type { ExecutionFormValue, GatekeeperSubmitResult } from './execution-block.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import type { TradingSessionState } from './trading-session.types';
import { formatSessionSummary } from './trading-session.utils';
import { computeRiskMetrics, formatUsd, isStopPlacementValid } from './execution-risk.utils';

@Component({
  selector: 'app-execution-block',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    SelectModule,
    InputNumberModule,
    TextareaModule,
    ButtonModule,
    MessageModule,
    DividerModule,
    TagModule,
    ConfirmDialogModule,
  ],
  templateUrl: './execution-block.component.html',
  styleUrl: './execution-block.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService],
})
export class ExecutionBlockComponent {
  private readonly fb = inject(FormBuilder);
  private readonly submitService = inject(GatekeeperSubmitService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly pillarsQualified = input.required<boolean>();
  readonly readinessPct = input.required<number>();
  readonly auditDraft = input.required<GatekeeperFormValue | null>();
  readonly sessionState = input.required<TradingSessionState | null>();

  readonly tradeSubmitted = output<GatekeeperSubmitResult>();

  protected readonly executionForm = createExecutionForm(this.fb);
  protected readonly submitting = signal(false);
  private readonly formTick = signal(0);
  protected readonly riskMetrics = signal(
    computeRiskMetrics({
      symbol: 'ES',
      direction: 'LONG',
      entry_price: 0,
      stop_price: 0,
      size: 1,
      target_price: null,
    }),
  );

  protected readonly directionOptions = TRADE_DIRECTION_OPTIONS;
  protected readonly dayTypeOptions = DAY_TYPE_OPTIONS;

  protected readonly sessionSummary = computed(() => {
    const state = this.sessionState();
    if (!state) {
      return null;
    }
    return formatSessionSummary(state.session, state.symbol);
  });

  protected readonly isLocked = computed(() => !this.pillarsQualified());

  protected readonly lockReason = computed(() => {
    if (this.pillarsQualified()) {
      return null;
    }
    return 'Complete all four pillars and confirm retest to unlock execution.';
  });

  protected readonly canSubmit = computed(() => {
    this.formTick();
    if (this.isLocked() || this.submitting()) {
      return false;
    }
    const value = this.executionForm.getRawValue() as ExecutionFormValue;
    return (
      this.sessionState() !== null &&
      this.pillarsQualified() &&
      this.readinessPct() === 100 &&
      this.executionForm.valid &&
      isStopPlacementValid(value) &&
      this.auditDraft() !== null
    );
  });

  protected readonly stopPlacementError = computed(() => {
    const direction = this.executionForm.get('direction')?.value;
    return direction === 'LONG'
      ? 'Stop must be below entry for LONG'
      : 'Stop must be above entry for SHORT';
  });

  constructor() {
    effect(() => {
      const state = this.sessionState();
      if (state?.symbol) {
        this.executionForm.patchValue({ symbol: state.symbol }, { emitEvent: true });
      }
    });

    this.executionForm.valueChanges.subscribe(() => {
      this.formTick.update((n) => n + 1);
      const value = this.executionForm.getRawValue() as ExecutionFormValue;
      if (
        value.entry_price &&
        value.stop_price &&
        value.size &&
        isStopPlacementValid(value)
      ) {
        this.riskMetrics.set(computeRiskMetrics(value));
      }
    });
  }

  resetExecutionForm(): void {
    const symbol = this.sessionState()?.symbol ?? 'EURUSD';
    this.executionForm.reset({
      symbol,
      direction: 'LONG',
      day_type: 'D_Day',
      entry_price: null,
      stop_price: null,
      size: null,
      target_price: null,
      notes: null,
    });
    this.formTick.update((n) => n + 1);
  }

  protected onSubmit(): void {
    if (!this.canSubmit()) {
      this.executionForm.markAllAsTouched();
      return;
    }

    const exec = this.executionForm.getRawValue() as ExecutionFormValue;
    const auditForm = this.auditDraft();
    const session = this.sessionState();
    if (!auditForm || !session) {
      return;
    }

    const risk = computeRiskMetrics(exec);
    const rLabel = risk.r_target != null ? `${risk.r_target}R` : '—';

    this.confirmationService.confirm({
      header: 'Confirm Execution',
      message: `Total risk ${formatUsd(risk.total_risk)} at ${rLabel}. Proceed?`,
      accept: () => {
        void this.executeSubmit(exec, auditForm);
      },
    });
  }

  private async executeSubmit(
    exec: ExecutionFormValue,
    auditForm: GatekeeperFormValue,
  ): Promise<void> {
    const session = this.sessionState();
    if (!session) {
      return;
    }

    this.submitting.set(true);

    try {
      const audit = this.submitService.mapFormToAudit(auditForm);
      const result = await this.submitService.submitQualifiedTrade({
        trade: {
          symbol: session.symbol,
          direction: exec.direction,
          day_type: exec.day_type,
          entry_price: exec.entry_price,
          stop_price: exec.stop_price,
          size: exec.size,
          notes: exec.notes,
          trading_date: session.session.trading_date,
          session_context: session.session,
          status: 'OPEN',
          readiness_pct_at_entry: 100,
        },
        audit,
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Trade opened',
        detail: `Trade recorded with full qualification (ID: ${result.tradeId.slice(0, 8)}…).`,
      });

      this.tradeSubmitted.emit(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submit failed';
      this.messageService.add({
        severity: 'error',
        summary: 'Execution blocked',
        detail: message,
      });
    } finally {
      this.submitting.set(false);
    }
  }
}
