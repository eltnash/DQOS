import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import type {
  AuctionLocation,
  ConfirmationTrigger,
  MarketBehavior,
} from '../../core/models/database.types';

const THESIS_MIN_LENGTH = 20;
const THESIS_MAX_LENGTH = 2000;

export function thesisValidators(): ValidatorFn[] {
  return [
    Validators.required,
    Validators.minLength(THESIS_MIN_LENGTH),
    Validators.maxLength(THESIS_MAX_LENGTH),
    Validators.pattern(/\S/),
  ];
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

export function createGatekeeperForm(fb: FormBuilder) {
  return fb.group({
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
