import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
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
import type { GatekeeperDraftLoadResult } from './gatekeeper-draft.types';
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
    DatePickerModule,
    SelectModule,
    ButtonModule,
    InputTextModule,
    EnumPillSelectComponent,
  ],
  templateUrl: './trading-session-bar.component.html',
  styleUrl: './trading-session-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradingSessionBarComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
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
    this.emitState();
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
