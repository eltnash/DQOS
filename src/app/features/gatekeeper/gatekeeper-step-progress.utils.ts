import { FormBuilder, FormGroup } from '@angular/forms';

import type { AnalyzedTimeframe, AssetSymbol, PillarStepKey } from '../../core/models/database.types';
import { ANALYZED_TIMEFRAME_KEYS } from '../../core/supabase/enum-options';
import { createExecutionForm, executionFormToDraftValue, patchExecutionFormFromDraft } from './execution-form.factory';
import { isStopPlacementValid } from './execution-risk.utils';
import type { ExecutionFormValue } from './execution-block.types';
import type { GatekeeperStepKey } from './gatekeeper-form.types';
import type { GatekeeperFormValue } from './gatekeeper-form.types';
import { createGatekeeperForm, syncGatekeeperFormValidators } from './gatekeeper-form.factory';
import {
  GATEKEEPER_STEP_LABELS,
  type GatekeeperDraftMedia,
} from './gatekeeper-draft.types';

export interface GatekeeperStepProgressItem {
  number: number;
  label: string;
  complete: boolean;
  current: boolean;
}

export interface GatekeeperStepProgress {
  steps: GatekeeperStepProgressItem[];
  completedCount: number;
  totalSteps: number;
  progressPct: number;
}

const STEP_KEYS: (GatekeeperStepKey | 'execution')[] = [
  'context',
  'auction_type',
  'location',
  'behavior',
  'confirmation',
  'invalidation',
  'execution',
];

function hasHtfMedia(media: GatekeeperDraftMedia, tf: AnalyzedTimeframe): boolean {
  return (media.htf[tf]?.length ?? 0) > 0;
}

function hasPillarMedia(media: GatekeeperDraftMedia, step: PillarStepKey): boolean {
  return (media.pillars[step]?.length ?? 0) > 0;
}

function selectedTimeframes(form: FormGroup): AnalyzedTimeframe[] {
  const timeframes = form.get('context.analyzed_timeframes') as FormGroup;
  return ANALYZED_TIMEFRAME_KEYS.filter((tf) => timeframes.get(tf)?.value === true);
}

function isContextComplete(form: FormGroup, media: GatekeeperDraftMedia): boolean {
  const context = form.get('context') as FormGroup;
  if (!context.valid) {
    return false;
  }

  const selected = selectedTimeframes(form);
  if (selected.length === 0) {
    return false;
  }

  const journals = context.get('timeframe_journals') as FormGroup;
  return selected.every((tf) => {
    const block = journals.get(tf) as FormGroup;
    return block.valid && hasHtfMedia(media, tf);
  });
}

function isAuctionTypeComplete(form: FormGroup): boolean {
  return (form.get('auction_type') as FormGroup).valid;
}

function isLocationComplete(form: FormGroup, media: GatekeeperDraftMedia): boolean {
  if (!isAuctionTypeComplete(form)) {
    return false;
  }

  return (
    (form.get('location') as FormGroup).valid &&
    hasPillarMedia(media, 'location')
  );
}

function isBehaviorComplete(form: FormGroup, media: GatekeeperDraftMedia): boolean {
  if (!isLocationComplete(form, media)) {
    return false;
  }

  return (
    (form.get('behavior') as FormGroup).valid &&
    hasPillarMedia(media, 'behavior')
  );
}

function isConfirmationComplete(form: FormGroup, media: GatekeeperDraftMedia): boolean {
  if (!isBehaviorComplete(form, media)) {
    return false;
  }

  return (
    (form.get('confirmation') as FormGroup).valid &&
    hasPillarMedia(media, 'confirmation')
  );
}

function isInvalidationComplete(form: FormGroup, media: GatekeeperDraftMedia): boolean {
  if (!isConfirmationComplete(form, media)) {
    return false;
  }

  return (
    form.controls['is_retest'].valid &&
    (form.get('invalidation') as FormGroup).valid &&
    hasPillarMedia(media, 'invalidation')
  );
}

function isExecutionComplete(
  form: FormGroup,
  media: GatekeeperDraftMedia,
  executionForm: FormGroup,
): boolean {
  if (!isInvalidationComplete(form, media)) {
    return false;
  }

  return executionForm.valid && isStopPlacementValid(executionFormToDraftValue(executionForm));
}

function isStepComplete(
  key: GatekeeperStepKey | 'execution',
  form: FormGroup,
  media: GatekeeperDraftMedia,
  executionForm: FormGroup,
): boolean {
  switch (key) {
    case 'context':
      return isContextComplete(form, media);
    case 'auction_type':
      return isAuctionTypeComplete(form);
    case 'location':
      return isLocationComplete(form, media);
    case 'behavior':
      return isBehaviorComplete(form, media);
    case 'confirmation':
      return isConfirmationComplete(form, media);
    case 'invalidation':
      return isInvalidationComplete(form, media);
    case 'execution':
      return isExecutionComplete(form, media, executionForm);
  }
}

export function computeGatekeeperStepProgress(input: {
  wizardForm: GatekeeperFormValue;
  media: GatekeeperDraftMedia;
  executionForm: ExecutionFormValue;
  symbol: AssetSymbol;
  activeStep: number;
}): GatekeeperStepProgress {
  const fb = new FormBuilder();
  const form = createGatekeeperForm(fb);
  form.patchValue(input.wizardForm, { emitEvent: false });
  syncGatekeeperFormValidators(form);

  const executionFormGroup = createExecutionForm(fb);
  patchExecutionFormFromDraft(executionFormGroup, input.executionForm, input.symbol);
  executionFormGroup.updateValueAndValidity({ emitEvent: false });

  const activeStep = Math.max(1, Math.min(input.activeStep, STEP_KEYS.length));
  const steps = STEP_KEYS.map((key, index) => {
    const number = index + 1;
    return {
      number,
      label: GATEKEEPER_STEP_LABELS[index],
      complete: isStepComplete(key, form, input.media, executionFormGroup),
      current: number === activeStep,
    };
  });

  const completedCount = steps.filter((step) => step.complete).length;

  return {
    steps,
    completedCount,
    totalSteps: STEP_KEYS.length,
    progressPct: Math.round((completedCount / STEP_KEYS.length) * 100),
  };
}
