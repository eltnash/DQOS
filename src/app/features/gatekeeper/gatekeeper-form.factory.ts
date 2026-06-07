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
  ConfirmationTrigger,
  MarketBehavior,
} from '../../core/models/database.types';
import { ANALYZED_TIMEFRAME_KEYS } from '../../core/supabase/enum-options';

const THESIS_MIN_LENGTH = 20;
const THESIS_MAX_LENGTH = 2000;
const JOURNAL_NOTES_MIN = 20;
const JOURNAL_NOTES_MAX = 4000;

export function thesisValidators(): ValidatorFn[] {
  return [
    Validators.required,
    Validators.minLength(THESIS_MIN_LENGTH),
    Validators.maxLength(THESIS_MAX_LENGTH),
    Validators.pattern(/\S/),
  ];
}

function journalNotesValidators(): ValidatorFn[] {
  return [
    Validators.required,
    Validators.minLength(JOURNAL_NOTES_MIN),
    Validators.maxLength(JOURNAL_NOTES_MAX),
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

function createJournalBlock(fb: FormBuilder) {
  return fb.group({
    notes: fb.nonNullable.control('', []),
  });
}

function applyJournalValidators(block: FormGroup, enabled: boolean): void {
  block.get('notes')?.setValidators(enabled ? journalNotesValidators() : []);
  block.get('notes')?.updateValueAndValidity({ emitEvent: false });
}

function createTimeframeJournalsGroup(fb: FormBuilder) {
  const blocks = ANALYZED_TIMEFRAME_KEYS.reduce(
    (acc, tf) => {
      acc[tf] = createJournalBlock(fb);
      return acc;
    },
    {} as Record<AnalyzedTimeframe, ReturnType<typeof createJournalBlock>>,
  );

  return fb.group(blocks);
}

export function createGatekeeperForm(fb: FormBuilder) {
  const form = fb.group({
    context: fb.group({
      analyzed_timeframes: createTimeframeGroup(fb),
      trading_timeframe: fb.nonNullable.control<'M15'>('M15'),
      timeframe_journals: createTimeframeJournalsGroup(fb),
    }),
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

  const context = form.get('context') as FormGroup;
  const timeframes = context.get('analyzed_timeframes') as FormGroup;
  const journals = context.get('timeframe_journals') as FormGroup;

  ANALYZED_TIMEFRAME_KEYS.forEach((tf) => {
    applyJournalValidators(journals.get(tf) as FormGroup, false);

    timeframes.get(tf)?.valueChanges.subscribe((enabled) => {
      applyJournalValidators(journals.get(tf) as FormGroup, enabled === true);
      if (!enabled) {
        journals.get(tf)?.patchValue({ notes: '' }, { emitEvent: false });
      }
      journals.get(tf)?.updateValueAndValidity({ emitEvent: true });
    });
  });

  return form;
}
