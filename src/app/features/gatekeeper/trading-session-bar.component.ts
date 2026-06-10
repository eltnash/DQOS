import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

import type { AssetSymbol } from '../../core/models/database.types';
import {
  ANALYSIS_PERIOD_OPTIONS,
  ASSET_SYMBOL_OPTIONS,
  MARKET_SESSION_OPTIONS,
  TIMEZONE_OPTIONS,
} from '../../core/supabase/enum-options';
import { EnumPillSelectComponent } from '../../shared/components/enum-pill-select/enum-pill-select.component';
import { GatekeeperDraftService } from './gatekeeper-draft.service';
import { JOURNAL_NAME_MAX_LENGTH, type GatekeeperDraftLoadResult } from './gatekeeper-draft.types';
import type { TradingSessionChangeEvent, TradingSessionFormValue } from './trading-session.types';
import {
  defaultBrowserTimezone,
  formatSessionClock,
  mapSessionFormToContext,
  startOfToday,
} from './trading-session.utils';

@Component({
  selector: 'app-trading-session-bar',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DatePickerModule,
    SelectModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    EnumPillSelectComponent,
  ],
  templateUrl: './trading-session-bar.component.html',
  styleUrl: './trading-session-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradingSessionBarComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly messageService = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  readonly sessionChange = output<TradingSessionChangeEvent>();

  protected readonly form = this.fb.group({
    journal_name: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(80),
      Validators.pattern(/\S/),
    ]),
    trading_date: this.fb.control<Date | null>(startOfToday(), Validators.required),
    market_session: this.fb.control<import('../../core/models/database.types').MarketSession | null>(
      null,
      Validators.required,
    ),
    analysis_period: this.fb.control<import('../../core/models/database.types').AnalysisPeriod | null>(
      null,
      Validators.required,
    ),
    analysis_recorded_at: this.fb.control<Date | null>(new Date(), Validators.required),
    timezone: this.fb.nonNullable.control('AUTO'),
    symbol: this.fb.control<AssetSymbol | null>('EURUSD', Validators.required),
  });

  protected readonly marketSessionOptions = MARKET_SESSION_OPTIONS;
  protected readonly analysisPeriodOptions = ANALYSIS_PERIOD_OPTIONS;
  protected readonly timezoneOptions = TIMEZONE_OPTIONS;
  protected readonly symbolOptions = ASSET_SYMBOL_OPTIONS;

  protected readonly liveClockLabel = signal('');
  protected readonly journalNameLocked = signal(false);
  protected readonly renameDialogVisible = signal(false);
  protected readonly renameSaving = signal(false);
  protected renameDraftName = '';
  protected readonly journalNameMaxLength = JOURNAL_NAME_MAX_LENGTH;

  ngOnInit(): void {
    this.updateLiveClock();
    this.clockTimer = setInterval(() => this.updateLiveClock(), 30_000);
    this.form.valueChanges.subscribe(() => this.emitState());
    this.emitState();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
  }

  applyLoadedDraft(draft: GatekeeperDraftLoadResult): void {
    const recordedAt = new Date(draft.sessionContext.analysis_recorded_at);
    const [year, month, day] = draft.tradingDate.split('-').map(Number);
    this.form.patchValue(
      {
        journal_name: draft.journalName,
        trading_date: new Date(year, month - 1, day),
        market_session: draft.sessionContext.market_session,
        analysis_period: draft.sessionContext.analysis_period,
        analysis_recorded_at: recordedAt,
        timezone: draft.sessionContext.timezone,
        symbol: draft.symbol,
      },
      { emitEvent: true },
    );

    this.form.controls.journal_name.disable({ emitEvent: false });
    this.journalNameLocked.set(true);
    this.emitState();
  }

  resetForNewJournal(): void {
    this.form.reset({
      journal_name: '',
      trading_date: startOfToday(),
      market_session: null,
      analysis_period: null,
      analysis_recorded_at: new Date(),
      timezone: 'AUTO',
      symbol: 'EURUSD',
    });
    this.form.controls.journal_name.enable({ emitEvent: false });
    this.journalNameLocked.set(false);
    this.emitState();
  }

  protected openRenameDialog(): void {
    this.renameDraftName = this.form.controls.journal_name.getRawValue();
    this.renameDialogVisible.set(true);
  }

  protected closeRenameDialog(): void {
    if (this.renameSaving()) {
      return;
    }
    this.renameDialogVisible.set(false);
    this.renameDraftName = '';
  }

  protected async confirmRename(): Promise<void> {
    const draftId = this.draftService.activeDraftId();
    if (!draftId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Rename unavailable',
        detail: 'Save progress once before renaming this journal.',
        life: 5000,
      });
      return;
    }

    this.renameSaving.set(true);
    this.cdr.markForCheck();

    try {
      const updatedName = await this.draftService.renameJournal(draftId, this.renameDraftName);
      this.form.patchValue({ journal_name: updatedName });
      this.form.controls.journal_name.disable({ emitEvent: false });
      this.renameDialogVisible.set(false);
      this.renameDraftName = '';
      this.messageService.add({
        severity: 'success',
        summary: 'Journal renamed',
        detail: `Renamed to "${updatedName}".`,
        life: 3500,
      });
      this.emitState();
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Rename failed',
        detail: err instanceof Error ? err.message : 'Could not rename journal',
        life: 6000,
      });
    } finally {
      this.renameSaving.set(false);
      this.cdr.markForCheck();
    }
  }

  protected resolvedTimezone(): string {
    const value = this.form.controls.timezone.value;
    return value === 'AUTO' ? defaultBrowserTimezone() : value;
  }

  protected syncRecordedTimeToNow(): void {
    this.form.patchValue({ analysis_recorded_at: new Date() });
  }

  private updateLiveClock(): void {
    const recorded = this.form.controls.analysis_recorded_at.value ?? new Date();
    this.liveClockLabel.set(formatSessionClock(recorded.toISOString(), this.resolvedTimezone()));
  }

  private emitState(): void {
    this.updateLiveClock();

    if (this.form.invalid) {
      this.sessionChange.emit({ valid: false, state: null });
      return;
    }

    const raw = this.form.getRawValue() as TradingSessionFormValue;
    const timezone = raw.timezone === 'AUTO' ? defaultBrowserTimezone() : raw.timezone;
    const session = mapSessionFormToContext({ ...raw, timezone });

    if (!raw.symbol || !raw.journal_name.trim()) {
      this.sessionChange.emit({ valid: false, state: null });
      return;
    }

    this.sessionChange.emit({
      valid: true,
      state: {
        journalName: raw.journal_name.trim(),
        session,
        symbol: raw.symbol,
      },
    });
  }
}
