import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  inject,
  input,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import type { PillOption } from './enum-pill-select.types';

@Component({
  selector: 'app-enum-pill-select',
  templateUrl: './enum-pill-select.component.html',
  styleUrl: './enum-pill-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EnumPillSelectComponent),
      multi: true,
    },
  ],
})
export class EnumPillSelectComponent<T extends string = string> implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  readonly options = input.required<PillOption<T>[]>();
  readonly ariaLabel = input('Select option');
  readonly multiple = input(false);

  protected value: T | T[] | null = null;
  protected disabled = false;

  private onChange: (value: T | T[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  protected isSelected(optionValue: T): boolean {
    if (this.multiple()) {
      return Array.isArray(this.value) && this.value.includes(optionValue);
    }
    return this.value === optionValue;
  }

  protected select(optionValue: T): void {
    if (this.disabled) {
      return;
    }

    if (this.multiple()) {
      const current = Array.isArray(this.value) ? [...this.value] : [];
      const index = current.indexOf(optionValue);
      if (index >= 0) {
        current.splice(index, 1);
      } else {
        current.push(optionValue);
      }
      this.value = current;
      this.onChange(current);
    } else {
      this.value = optionValue;
      this.onChange(optionValue);
    }

    this.onTouched();
    this.cdr.markForCheck();
  }

  writeValue(value: T | T[] | null): void {
    this.value = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: T | T[] | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }
}
