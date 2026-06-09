import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import type { AssetSymbol, PlatformOrderType, TradeDirection } from '../../core/models/database.types';
import { isStopPlacementValid } from './execution-risk.utils';
import type { ExecutionFormValue } from './execution-block.types';

export function stopPlacementValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.getRawValue() as ExecutionFormValue;
    if (!value.entry_price || !value.stop_price || !value.order_type) {
      return null;
    }
    return isStopPlacementValid(value) ? null : { stopPlacement: true };
  };
}

export function createExecutionForm(fb: FormBuilder) {
  return fb.group(
    {
      ticket: fb.control<string | null>(null, Validators.maxLength(64)),
      symbol: fb.nonNullable.control<AssetSymbol>('ES', Validators.required),
      order_type: fb.nonNullable.control<PlatformOrderType>('Market_Execution_Buy', Validators.required),
      direction: fb.nonNullable.control<TradeDirection>('LONG', Validators.required),
      volume: fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0.000001),
      ]),
      entry_time: fb.control<Date | null>(null),
      entry_price: fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0.000001),
      ]),
      stop_price: fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0.000001),
      ]),
      take_profit_price: fb.control<number | null>(null),
      exit_time: fb.control<Date | null>(null),
      exit_price: fb.control<number | null>(null),
      commission: fb.control<number | null>(null),
      fee: fb.control<number | null>(null),
      swap: fb.control<number | null>(null),
      profit: fb.control<number | null>(null),
      comment: fb.control<string | null>(null, Validators.maxLength(2000)),
    },
    { validators: [stopPlacementValidator()] },
  );
}

export type ExecutionFormControls = ReturnType<typeof createExecutionForm>;

export function executionFormToDraftValue(form: ExecutionFormControls): ExecutionFormValue {
  const raw = form.getRawValue();
  return {
    ticket: raw.ticket?.trim() || null,
    symbol: raw.symbol,
    order_type: raw.order_type,
    direction: raw.direction,
    volume: raw.volume,
    entry_time: raw.entry_time?.toISOString() ?? null,
    entry_price: raw.entry_price,
    stop_price: raw.stop_price,
    take_profit_price: raw.take_profit_price,
    exit_time: raw.exit_time?.toISOString() ?? null,
    exit_price: raw.exit_price,
    commission: raw.commission,
    fee: raw.fee,
    swap: raw.swap,
    profit: raw.profit,
    comment: raw.comment?.trim() || null,
  };
}

export function patchExecutionFormFromDraft(
  form: ExecutionFormControls,
  draft: ExecutionFormValue,
  symbol: AssetSymbol,
): void {
  form.patchValue(
    {
      ticket: draft.ticket,
      symbol,
      order_type: draft.order_type,
      direction: draft.direction,
      volume: draft.volume,
      entry_time: draft.entry_time ? new Date(draft.entry_time) : null,
      entry_price: draft.entry_price,
      stop_price: draft.stop_price,
      take_profit_price: draft.take_profit_price,
      exit_time: draft.exit_time ? new Date(draft.exit_time) : null,
      exit_price: draft.exit_price,
      commission: draft.commission,
      fee: draft.fee,
      swap: draft.swap,
      profit: draft.profit,
      comment: draft.comment,
    },
    { emitEvent: false },
  );
}
