import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';

import type { AssetSymbol } from '../../../core/models/database.types';
import { TRADE_DIRECTION_OPTIONS } from '../../../core/supabase/enum-options';
import { GatekeeperDraftService } from '../gatekeeper-draft.service';
import { GatekeeperSubmitService } from '../gatekeeper-submit.service';
import { dayTypeLabel } from '../auction-playbook.utils';
import {
  createExecutionForm,
  executionFormToDraftValue,
  patchExecutionFormFromDraft,
} from '../execution-form.factory';
import type { ExecutionFormValue, GatekeeperSubmitResult } from '../execution-block.types';
import type { GatekeeperFormValue } from '../gatekeeper-form.types';
import type { TradingSessionState } from '../trading-session.types';
import { formatSessionSummary } from '../trading-session.utils';
import { computeRiskMetrics, formatUsd, isStopPlacementValid } from '../execution-risk.utils';

@Component({
  selector: 'app-execution-step-panel',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    DatePickerModule,
    InputTextModule,
    SelectModule,
    InputNumberModule,
    TextareaModule,
    ButtonModule,
    MessageModule,
    TagModule,
    ConfirmDialogModule,
  ],
  templateUrl: './execution-step-panel.component.html',
  styleUrl: './execution-step-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService],
})
export class ExecutionStepPanelComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly submitService = inject(GatekeeperSubmitService);
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly sessionState = input.required<TradingSessionState | null>();
  readonly pillarsQualified = input.required<boolean>();
  readonly unlockForTesting = input(false);
  readonly readinessPct = input.required<number>();
  readonly auditDraft = input.required<GatekeeperFormValue | null>();

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
      volume: 1,
      take_profit_price: null,
    }),
  );

  protected readonly directionOptions = TRADE_DIRECTION_OPTIONS;
  protected readonly dayTypeLabel = dayTypeLabel;

  protected readonly sessionSummary = computed(() => {
    const state = this.sessionState();
    if (!state) {
      return null;
    }
    return formatSessionSummary(state.session, state.symbol);
  });

  protected readonly isLocked = computed(() => !this.unlockForTesting() && !this.pillarsQualified());

  protected readonly lockReason = computed(() => {
    if (this.pillarsQualified()) {
      return null;
    }
    return 'Complete HTF context, auction type, all four pillars, and confirm retest before recording execution.';
  });

  protected readonly canSubmit = computed(() => {
    this.formTick();
    if (this.isLocked() || this.submitting()) {
      return false;
    }
    const value = executionFormToDraftValue(this.executionForm);
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
      ? 'Stop must be below entry for a buy'
      : 'Stop must be above entry for a sell';
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
      const value = executionFormToDraftValue(this.executionForm);
      if (
        value.entry_price &&
        value.stop_price &&
        value.volume &&
        isStopPlacementValid(value)
      ) {
        this.riskMetrics.set(computeRiskMetrics(value));
      }

      if (this.draftService.activeDraftId() && !this.isLocked()) {
        this.draftService.scheduleExecutionSave(value);
      }
    });
  }

  ngOnInit(): void {
    const snapshot = this.draftService.peekExecutionSnapshot();
    const session = this.sessionState();
    if (snapshot && session) {
      this.loadFromDraft(snapshot, session.symbol);
    }
  }

  isStepComplete(): boolean {
    return !this.isLocked() && this.executionForm.valid && isStopPlacementValid(executionFormToDraftValue(this.executionForm));
  }

  getDraftValue(): ExecutionFormValue {
    return executionFormToDraftValue(this.executionForm);
  }

  flushDraftSave(): void {
    if (this.draftService.activeDraftId() && !this.isLocked()) {
      this.draftService.scheduleExecutionSave(this.getDraftValue());
    }
  }

  loadFromDraft(executionForm: ExecutionFormValue, symbol: AssetSymbol): void {
    patchExecutionFormFromDraft(this.executionForm, executionForm, symbol);
    this.formTick.update((n) => n + 1);

    const value = executionFormToDraftValue(this.executionForm);
    if (
      value.entry_price &&
      value.stop_price &&
      value.volume &&
      isStopPlacementValid(value)
    ) {
      this.riskMetrics.set(computeRiskMetrics(value));
    }
  }

  resetForm(): void {
    const symbol = this.sessionState()?.symbol ?? 'EURUSD';
    this.executionForm.reset({
      ticket: null,
      symbol,
      direction: 'LONG',
      volume: null,
      entry_time: null,
      entry_price: null,
      stop_price: null,
      take_profit_price: null,
      exit_time: null,
      exit_price: null,
      commission: null,
      fee: null,
      swap: null,
      profit: null,
      comment: null,
    });
    this.formTick.update((n) => n + 1);
  }

  protected onSubmit(): void {
    if (!this.canSubmit()) {
      this.executionForm.markAllAsTouched();
      return;
    }

    const exec = executionFormToDraftValue(this.executionForm);
    const auditForm = this.auditDraft();
    if (!auditForm?.auction_type.day_type) {
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
    const dayType = auditForm.auction_type.day_type;
    if (!session || !dayType) {
      return;
    }

    this.submitting.set(true);

    try {
      const audit = this.submitService.mapFormToAudit(auditForm);
      const isClosed = exec.exit_price != null && exec.exit_time != null;
      const result = await this.submitService.submitQualifiedTrade(
        {
          trade: {
            symbol: session.symbol,
            direction: exec.direction,
            day_type: dayType,
            entry_price: exec.entry_price!,
            stop_price: exec.stop_price!,
            size: this.mapVolumeToTradeSize(exec.volume!),
            notes: this.buildTradeNotes(exec),
            trading_date: session.session.trading_date,
            session_context: session.session,
            status: isClosed ? 'CLOSED' : 'OPEN',
            readiness_pct_at_entry: 100,
            opened_at: exec.entry_time ?? undefined,
            closed_at: exec.exit_time,
            exit_price: exec.exit_price,
            commissions: exec.commission ?? 0,
            net_profit: exec.profit,
          },
          audit,
        },
        auditForm,
      );

      this.messageService.add({
        severity: 'success',
        summary: 'Trade recorded',
        detail: `Full journal saved to ledger (ID: ${result.tradeId.slice(0, 8)}…).`,
      });

      this.tradeSubmitted.emit(result);
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Execution blocked',
        detail: err instanceof Error ? err.message : 'Submit failed',
        life: 6000,
      });
    } finally {
      this.submitting.set(false);
    }
  }

  private mapVolumeToTradeSize(volume: number): number {
    return Math.max(1, Math.round(volume));
  }

  private buildTradeNotes(exec: ExecutionFormValue): string | null {
    const parts: string[] = [];
    if (exec.ticket) {
      parts.push(`Ticket: ${exec.ticket}`);
    }
    if (exec.volume != null) {
      parts.push(`Volume: ${exec.volume} lots`);
    }
    if (exec.fee != null) {
      parts.push(`Fee: ${exec.fee}`);
    }
    if (exec.swap != null) {
      parts.push(`Swap: ${exec.swap}`);
    }
    if (exec.comment) {
      parts.push(exec.comment);
    }
    return parts.length > 0 ? parts.join(' | ') : null;
  }
}
