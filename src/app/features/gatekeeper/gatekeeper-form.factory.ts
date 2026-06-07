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
  DayType,
  HtfAnalysisTool,
  HtfAuctionRegime,
  CompositeValuePosition,
  MarketBehavior,
  PillarFocusTimeframe,
} from '../../core/models/database.types';
import { ANALYZED_TIMEFRAME_KEYS, HTF_ANALYSIS_TOOL_OPTIONS } from '../../core/supabase/enum-options';
import {
  EMPTY_TAGGED_NOTES,
  taggedNotesPlainText,
} from '../../shared/components/tagged-notes-editor/tagged-notes.utils';
import type { TaggedNotesValue } from '../../shared/components/tagged-notes-editor/tagged-notes.types';

const JOURNAL_NOTES_MIN = 20;
const JOURNAL_NOTES_MAX = 4000;

function journalNotesContentValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as TaggedNotesValue;
    const text = taggedNotesPlainText(value);
    if (text.length < JOURNAL_NOTES_MIN) {
      return { minlength: { requiredLength: JOURNAL_NOTES_MIN, actualLength: text.length } };
    }
    if (text.length > JOURNAL_NOTES_MAX) {
      return { maxlength: { requiredLength: JOURNAL_NOTES_MAX, actualLength: text.length } };
    }
    if (!/\S/.test(text)) {
      return { pattern: true };
    }
    return null;
  };
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

const NARRATIVE_TEXT_MIN = 20;
const NARRATIVE_TEXT_MAX = 4000;

function narrativeTextValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const text = (control.value as string | null)?.trim() ?? '';
    if (text.length < NARRATIVE_TEXT_MIN) {
      return { minlength: { requiredLength: NARRATIVE_TEXT_MIN, actualLength: text.length } };
    }
    if (text.length > NARRATIVE_TEXT_MAX) {
      return { maxlength: { requiredLength: NARRATIVE_TEXT_MAX, actualLength: text.length } };
    }
    if (!/\S/.test(text)) {
      return { pattern: true };
    }
    return null;
  };
}

function createHtfToolsGroup(fb: FormBuilder) {
  const controls = HTF_ANALYSIS_TOOL_OPTIONS.reduce(
    (acc, tool) => {
      acc[tool.key] = fb.nonNullable.control(false);
      return acc;
    },
    {} as Record<HtfAnalysisTool, ReturnType<FormBuilder['control']>>,
  );

  return fb.group(controls);
}

function createHtfNarrativeGroup(fb: FormBuilder) {
  return fb.group({
    value_migration: fb.nonNullable.control('', [narrativeTextValidator()]),
    composite_va_position: fb.control<CompositeValuePosition | null>(null, Validators.required),
    auction_regime: fb.control<HtfAuctionRegime | null>(null, Validators.required),
    tools_used: createHtfToolsGroup(fb),
    htf_trade_posture: fb.nonNullable.control('', [narrativeTextValidator()]),
    session_read: fb.nonNullable.control('', [narrativeTextValidator()]),
  });
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
    notes_content: fb.nonNullable.control<TaggedNotesValue>(EMPTY_TAGGED_NOTES, []),
  });
}

function applyJournalValidators(block: FormGroup, enabled: boolean): void {
  block.get('notes_content')?.setValidators(enabled ? [journalNotesContentValidator()] : []);
  block.get('notes_content')?.updateValueAndValidity({ emitEvent: false });
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

function createPillarStepBase(fb: FormBuilder) {
  return {
    focus_timeframe: fb.nonNullable.control<PillarFocusTimeframe>('M15', Validators.required),
    notes_content: fb.nonNullable.control<TaggedNotesValue>(EMPTY_TAGGED_NOTES, [
      journalNotesContentValidator(),
    ]),
  };
}

export function createGatekeeperForm(fb: FormBuilder) {
  const form = fb.group({
    context: fb.group({
      narrative: createHtfNarrativeGroup(fb),
      analyzed_timeframes: createTimeframeGroup(fb),
      trading_timeframe: fb.nonNullable.control<'M15'>('M15'),
      timeframe_journals: createTimeframeJournalsGroup(fb),
    }),
    auction_type: fb.group({
      day_type: fb.control<DayType | null>(null, Validators.required),
    }),
    is_retest: fb.nonNullable.control(false, { validators: [Validators.requiredTrue] }),
    location: fb.group({
      ...createPillarStepBase(fb),
      location: fb.control<AuctionLocation | null>(null, [
        Validators.required,
        retestGateValidator(),
      ]),
    }),
    behavior: fb.group({
      ...createPillarStepBase(fb),
      behavior: fb.control<MarketBehavior | null>(null, Validators.required),
    }),
    confirmation: fb.group({
      ...createPillarStepBase(fb),
      confirmation: fb.control<ConfirmationTrigger | null>(null, Validators.required),
    }),
    invalidation: fb.group({
      ...createPillarStepBase(fb),
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
        journals.get(tf)?.patchValue({ notes_content: EMPTY_TAGGED_NOTES }, { emitEvent: false });
      }
      journals.get(tf)?.updateValueAndValidity({ emitEvent: true });
    });
  });

  return form;
}
