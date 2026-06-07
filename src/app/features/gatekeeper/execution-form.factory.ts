import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import type { AssetSymbol, DayType, TradeDirection } from '../../core/models/database.types';
import { isStopPlacementValid } from './execution-risk.utils';
import type { ExecutionFormValue } from './execution-block.types';

export function stopPlacementValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.getRawValue() as ExecutionFormValue;
    if (!value.entry_price || !value.stop_price || !value.direction) {
      return null;
    }
    return isStopPlacementValid(value) ? null : { stopPlacement: true };
  };
}

export function createExecutionForm(fb: FormBuilder) {
  return fb.group(
    {
      symbol: fb.nonNullable.control<AssetSymbol>('ES', Validators.required),
      direction: fb.nonNullable.control<TradeDirection>('LONG', Validators.required),
      day_type: fb.nonNullable.control<DayType>('D_Day', Validators.required),
      entry_price: fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0.000001),
      ]),
      stop_price: fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0.000001),
      ]),
      size: fb.control<number | null>(null, [
        Validators.required,
        Validators.min(1),
        Validators.pattern(/^\d+$/),
      ]),
      target_price: fb.control<number | null>(null),
      notes: fb.control<string | null>(null, Validators.maxLength(2000)),
    },
    { validators: [stopPlacementValidator()] },
  );
}
