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
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';

import {
  AUCTION_LOCATION_OPTIONS,
  CONFIRMATION_TRIGGER_OPTIONS,
  MARKET_BEHAVIOR_OPTIONS,
} from '../../core/supabase/enum-options';
import { createGatekeeperForm } from './gatekeeper-form.factory';
import type { GatekeeperFormValue, GatekeeperStepKey } from './gatekeeper-form.types';
import type { PillarStepState } from '../../shared/components/readiness-meter/readiness-meter.types';

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
    SelectButtonModule,
    TextareaModule,
    CheckboxModule,
    InputNumberModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
  ],
  templateUrl: './gatekeeper-wizard.component.html',
  styleUrl: './gatekeeper-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatekeeperWizardComponent {
  private readonly fb = inject(FormBuilder);

  readonly pillarsChange = output<{
    pillarSteps: PillarStepState[];
    pillarsQualified: boolean;
    isRetest: boolean;
    formValue: GatekeeperFormValue | null;
  }>();

  protected readonly form = createGatekeeperForm(this.fb);
  protected readonly activeStep = signal(1);

  protected readonly locationOptions = AUCTION_LOCATION_OPTIONS;
  protected readonly behaviorOptions = MARKET_BEHAVIOR_OPTIONS;
  protected readonly confirmationOptions = CONFIRMATION_TRIGGER_OPTIONS;

  protected readonly steps: WizardStepMeta[] = [
    {
      key: 'location',
      number: 1,
      title: 'Location',
      methodology:
        'The level is not the trade. Identify where the auction must decide — VAH, VAL, POC, VWAP, overnight extremes, or single prints. Price in the middle of value = no trade.',
    },
    {
      key: 'behavior',
      number: 2,
      title: 'Behavior',
      methodology:
        'Do not ask if price touched a level. Ask: acceptance, rejection, or migration? The first test builds narrative — observe how the market responds.',
    },
    {
      key: 'confirmation',
      number: 3,
      title: 'Confirmation',
      methodology:
        'Location + behavior build context. Confirmation validates participation — CVD divergence, absorption, VWAP reclaim, or structure break at the retest.',
    },
    {
      key: 'invalidation',
      number: 4,
      title: 'Invalidation',
      methodology:
        'Where is the thesis objectively dead? Without structural invalidation, risk cannot be defined. Hitting invalidation means the auction narrative has failed.',
    },
  ];

  protected readonly currentStep = computed(() => this.steps[this.activeStep() - 1]);

  protected readonly pillarSteps = computed((): PillarStepState[] => {
    this.formTick();
    const value = this.form.getRawValue() as GatekeeperFormValue;
    return [
      {
        key: 'location',
        label: 'Location',
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

  private readonly formTick = signal(0);

  constructor() {
    this.form.valueChanges.subscribe(() => {
      this.formTick.update((n) => n + 1);
      this.emitState();
    });

    this.form.get('is_retest')?.valueChanges.subscribe(() => {
      this.form.get('location.location')?.updateValueAndValidity({ emitEvent: true });
    });

    this.emitState();
  }

  protected stepGroup(key: GatekeeperStepKey): FormGroup {
    return this.form.get(key) as FormGroup;
  }

  protected isStepValid(key: GatekeeperStepKey): boolean {
    if (key === 'location') {
      return this.form.controls.is_retest.valid && this.stepGroup('location').valid;
    }
    return this.stepGroup(key).valid;
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
    if (this.activeStep() < 4) {
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
    this.activeStep.set(1);
    this.emitState();
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
