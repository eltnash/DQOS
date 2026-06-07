import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import type {
  AnalyzedTimeframe,
  AuctionLocation,
  CompositeValuePosition,
  ConfirmationTrigger,
  HtfAnalysisTool,
  HtfAuctionRegime,
  MarketBehavior,
  MarketStructureBias,
  PriorWeekRangePosition,
} from '../../core/models/database.types';

const THESIS_MIN_LENGTH = 20;
const THESIS_MAX_LENGTH = 2000;
const POSTURE_MIN_LENGTH = 15;
const POSTURE_MAX_LENGTH = 1200;

export function thesisValidators(): ValidatorFn[] {
  return [
    Validators.required,
    Validators.minLength(THESIS_MIN_LENGTH),
    Validators.maxLength(THESIS_MAX_LENGTH),
    Validators.pattern(/\S/),
  ];
}

export function atLeastOneCheckedValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const group = control as FormGroup;
    const checked = Object.values(group.controls).some((field) => field.value === true);
    return checked ? null : { atLeastOneChecked: true };
  };
}

export function retestGateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const root = control.root;
    if (!root) {
      return null;
    }
    if (root.get('is_retest')?.value !== true) {
      return { retestRequired: true };
    }
    return null;
  };
}

export function weeklyContextValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const group = control as FormGroup;
    if (group.get('analyzed_timeframes.W')?.value !== true) {
      return null;
    }

    return group.get('prior_week_range_position')?.value ? null : { weeklyContextRequired: true };
  };
}

function createTimeframeGroup(fb: FormBuilder) {
  return fb.group(
    {
      M: fb.nonNullable.control(false),
      W: fb.nonNullable.control(false),
      D: fb.nonNullable.control(false),
      H4: fb.nonNullable.control(false),
      H1: fb.nonNullable.control(false),
    },
    { validators: [atLeastOneCheckedValidator()] },
  );
}

function createToolsGroup(fb: FormBuilder) {
  return fb.group(
    {
      Composite_VP: fb.nonNullable.control(false),
      Multi_Day_VAH_VAL_POC: fb.nonNullable.control(false),
      Major_HVN_LVN: fb.nonNullable.control(false),
      Multi_Day_TPO: fb.nonNullable.control(false),
      Value_Area_Migration: fb.nonNullable.control(false),
      Day_Type_Series: fb.nonNullable.control(false),
      Unfinished_Business: fb.nonNullable.control(false),
    },
    { validators: [atLeastOneCheckedValidator()] },
  );
}

export function createGatekeeperForm(fb: FormBuilder) {
  return fb.group({
    context: fb.group(
      {
        analyzed_timeframes: createTimeframeGroup(fb),
        trading_timeframe: fb.nonNullable.control<'M15'>('M15'),
        prior_week_range_position: fb.control<PriorWeekRangePosition | null>(null),
        composite_value_position: fb.control<CompositeValuePosition | null>(null, Validators.required),
        auction_regime: fb.control<HtfAuctionRegime | null>(null, Validators.required),
        structure_bias: fb.control<MarketStructureBias | null>(null, Validators.required),
        tools_used: createToolsGroup(fb),
        htf_thesis: fb.nonNullable.control('', thesisValidators()),
        session_posture: fb.nonNullable.control('', [
          Validators.required,
          Validators.minLength(POSTURE_MIN_LENGTH),
          Validators.maxLength(POSTURE_MAX_LENGTH),
          Validators.pattern(/\S/),
        ]),
      },
      { validators: [weeklyContextValidator()] },
    ),
    is_retest: fb.nonNullable.control(false, { validators: [Validators.requiredTrue] }),
    location: fb.group({
      location: fb.control<AuctionLocation | null>(null, [
        Validators.required,
        retestGateValidator(),
      ]),
      location_thesis: fb.nonNullable.control('', thesisValidators()),
    }),
    behavior: fb.group({
      behavior: fb.control<MarketBehavior | null>(null, Validators.required),
      behavior_thesis: fb.nonNullable.control('', thesisValidators()),
    }),
    confirmation: fb.group({
      confirmation: fb.control<ConfirmationTrigger | null>(null, Validators.required),
      confirmation_thesis: fb.nonNullable.control('', thesisValidators()),
    }),
    invalidation: fb.group({
      invalidation_level: fb.nonNullable.control('', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(120),
        Validators.pattern(/\S/),
      ]),
      invalidation_price: fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0.000001),
      ]),
      invalidation_thesis: fb.nonNullable.control('', thesisValidators()),
    }),
  });
}

export type TimeframeFormGroup = FormGroup<{
  [K in AnalyzedTimeframe]: ReturnType<FormBuilder['control']>;
}>;

export type ToolsFormGroup = FormGroup<{
  [K in HtfAnalysisTool]: ReturnType<FormBuilder['control']>;
}>;
