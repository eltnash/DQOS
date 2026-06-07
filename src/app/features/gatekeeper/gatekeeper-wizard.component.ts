import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';

import type { AnalyzedTimeframe } from '../../core/models/database.types';
import {
  ANALYZED_TIMEFRAME_KEYS,
  ANALYZED_TIMEFRAME_OPTIONS,
  AUCTION_LOCATION_OPTIONS,
  CONFIRMATION_TRIGGER_OPTIONS,
  MARKET_BEHAVIOR_OPTIONS,
} from '../../core/supabase/enum-options';
import { EnumPillSelectComponent } from '../../shared/components/enum-pill-select/enum-pill-select.component';
import { READINESS_WEIGHT_PER_STEP } from '../../shared/components/readiness-meter/readiness-meter.types';
import type { PillarStepState } from '../../shared/components/readiness-meter/readiness-meter.types';
import { createGatekeeperForm } from './gatekeeper-form.factory';
import type { GatekeeperFormValue, GatekeeperStepKey } from './gatekeeper-form.types';
import {
  EXECUTION_TIMEFRAME,
  formatHtfContextSummary,
  mapFormToHtfContext,
  timeframeLabel,
} from './htf-context.utils';
import { HtfScreenshotDraftService } from './htf-screenshot-draft.service';
import { TimeframeJournalPanelComponent } from './timeframe-journal-panel.component';

interface WizardStepMeta {
  key: GatekeeperStepKey;
  number: number;
  title: string;
  methodology: string;
}

@Component({
  selector: 'app-gatekeeper-wizard',
  imports: [
    ReactiveFormsModule,
    TimeframeJournalPanelComponent,
    EnumPillSelectComponent,
    TextareaModule,
    CheckboxModule,
    InputNumberModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    TagModule,
  ],
  templateUrl: './gatekeeper-wizard.component.html',
  styleUrl: './gatekeeper-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatekeeperWizardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly screenshotDrafts = inject(HtfScreenshotDraftService);

  readonly pillarsChange = output<{
    pillarSteps: PillarStepState[];
    pillarsQualified: boolean;
    isRetest: boolean;
    formValue: GatekeeperFormValue | null;
  }>();

  protected readonly form = createGatekeeperForm(this.fb);
  protected readonly activeStep = signal(1);
  protected readonly activeTimeframeTab = signal<AnalyzedTimeframe>('W');
  protected readonly executionTimeframe = EXECUTION_TIMEFRAME;

  protected readonly timeframeOptions = ANALYZED_TIMEFRAME_OPTIONS;
  protected readonly timeframeKeys = ANALYZED_TIMEFRAME_KEYS;
  protected readonly locationOptions = AUCTION_LOCATION_OPTIONS;
  protected readonly behaviorOptions = MARKET_BEHAVIOR_OPTIONS;
  protected readonly confirmationOptions = CONFIRMATION_TRIGGER_OPTIONS;

  protected readonly steps: WizardStepMeta[] = [
    {
      key: 'context',
      number: 1,
      title: 'HTF Context',
      methodology:
        'Select the timeframes relevant to today\'s trade. For each one, upload a chart screenshot, write notes, and annotate the image if you want. Execution decisions happen on 15m — this step is your visual journal.',
    },
    {
      key: 'location',
      number: 2,
      title: 'Location',
      methodology:
        'On your 15m execution timeframe: the level is not the trade. Identify where today\'s auction must decide — VAH, VAL, POC, VWAP, overnight extremes, or single prints. Price in the middle of value = no trade.',
    },
    {
      key: 'behavior',
      number: 3,
      title: 'Behavior',
      methodology:
        'How is today\'s session translating HTF narrative? Acceptance, rejection, or migration at the edge? The first test builds context — the retest is where opportunity lives.',
    },
    {
      key: 'confirmation',
      number: 4,
      title: 'Confirmation',
      methodology:
        'Location + behavior build context. Confirmation validates participation at the retest — CVD divergence, absorption, VWAP reclaim, or structure break.',
    },
    {
      key: 'invalidation',
      number: 5,
      title: 'Invalidation',
      methodology:
        'Where is the thesis objectively dead on your execution timeframe? Without structural invalidation, risk cannot be defined.',
    },
  ];

  protected readonly stepCount = this.steps.length;

  protected readonly selectedTimeframes = computed((): AnalyzedTimeframe[] => {
    this.formTick();
    return this.timeframeKeys.filter(
      (tf) => this.contextGroup().get('analyzed_timeframes')?.get(tf)?.value === true,
    );
  });

  protected readonly currentStep = computed(() => this.steps[this.activeStep() - 1]);

  protected readonly pillarSteps = computed((): PillarStepState[] => {
    this.formTick();
    this.screenshotDrafts.revisionSnapshot();
    const value = this.form.getRawValue() as GatekeeperFormValue;
    let contextSummary: string | null = null;
    if (this.isStepValid('context')) {
      try {
        contextSummary = formatHtfContextSummary(mapFormToHtfContext(value));
      } catch {
        contextSummary = null;
      }
    }

    return [
      {
        key: 'context',
        label: 'HTF Context',
        valid: this.isStepValid('context'),
        value: contextSummary,
      },
      {
        key: 'location',
        label: 'Location (15m)',
        valid: this.isStepValid('location'),
        value: value.location.location,
      },
      {
        key: 'behavior',
        label: 'Behavior',
        valid: this.isStepValid('behavior'),
        value: value.behavior.behavior,
      },
      {
        key: 'confirmation',
        label: 'Confirmation',
        valid: this.isStepValid('confirmation'),
        value: value.confirmation.confirmation,
      },
      {
        key: 'invalidation',
        label: 'Invalidation',
        valid: this.isStepValid('invalidation'),
        value: value.invalidation.invalidation_level || null,
      },
    ];
  });

  protected readonly pillarsQualified = computed(
    () => this.pillarSteps().every((step) => step.valid) && this.form.controls.is_retest.value,
  );

  protected readonly readinessPct = computed(
    () => this.pillarSteps().filter((step) => step.valid).length * READINESS_WEIGHT_PER_STEP,
  );

  private readonly formTick = signal(0);

  constructor() {
    this.form.valueChanges.subscribe(() => {
      this.formTick.update((n) => n + 1);
      this.ensureActiveTab();
      this.emitState();
    });

    this.form.get('is_retest')?.valueChanges.subscribe(() => {
      this.form.get('location.location')?.updateValueAndValidity({ emitEvent: true });
    });

    this.timeframeKeys.forEach((tf) => {
      this.contextGroup()
        .get('analyzed_timeframes')
        ?.get(tf)
        ?.valueChanges.subscribe((enabled) => {
          if (!enabled) {
            this.screenshotDrafts.removeDraft(tf);
          } else {
            this.activeTimeframeTab.set(tf);
          }
        });
    });

    this.emitState();
  }

  protected contextGroup(): FormGroup {
    return this.stepGroup('context');
  }

  protected journalGroup(tf: AnalyzedTimeframe): FormGroup {
    return (this.contextGroup().get('timeframe_journals') as FormGroup).get(tf) as FormGroup;
  }

  protected stepGroup(key: GatekeeperStepKey): FormGroup {
    return this.form.get(key) as FormGroup;
  }

  protected isStepValid(key: GatekeeperStepKey): boolean {
    if (key === 'context') {
      const selected = this.selectedTimeframes();
      return (
        this.stepGroup('context').valid &&
        selected.length > 0 &&
        this.screenshotDrafts.hasDraftsFor(selected)
      );
    }

    if (key === 'location') {
      return this.form.controls.is_retest.valid && this.stepGroup('location').valid;
    }

    return this.stepGroup(key).valid;
  }

  protected timeframeTabLabel(tf: AnalyzedTimeframe): string {
    return timeframeLabel(tf);
  }

  protected isTimeframeComplete(tf: AnalyzedTimeframe): boolean {
    return this.journalGroup(tf).valid && this.screenshotDrafts.hasDraft(tf);
  }

  protected selectedHint(options: { value: string; hint?: string }[], value: string | null): string {
    return options.find((option) => option.value === value)?.hint ?? '';
  }

  protected goNext(): void {
    const key = this.currentStep().key;
    this.stepGroup(key).markAllAsTouched();
    if (!this.isStepValid(key)) {
      return;
    }
    if (this.activeStep() < this.stepCount) {
      this.activeStep.update((n) => n + 1);
    }
  }

  protected goBack(): void {
    if (this.activeStep() > 1) {
      this.activeStep.update((n) => n - 1);
    }
  }

  resetWizard(): void {
    this.form.reset();
    this.screenshotDrafts.clearAll();
    this.activeStep.set(1);
    this.activeTimeframeTab.set('W');
    this.emitState();
  }

  private ensureActiveTab(): void {
    const selected = this.selectedTimeframes();
    if (selected.length === 0) {
      return;
    }
    if (!selected.includes(this.activeTimeframeTab())) {
      this.activeTimeframeTab.set(selected[0]);
    }
  }

  private emitState(): void {
    const qualified = this.pillarsQualified();
    this.pillarsChange.emit({
      pillarSteps: this.pillarSteps(),
      pillarsQualified: qualified,
      isRetest: this.form.controls.is_retest.value,
      formValue: qualified ? (this.form.getRawValue() as GatekeeperFormValue) : null,
    });
  }
}
