import type {
  GatekeeperFormValue,
  PillarStepFormValue,
} from './gatekeeper-form.types';
import type {
  PillarFocusTimeframe,
  PillarJournalsSnapshot,
  PillarStepJournal,
  PillarStepKey,
  QualificationPillarKey,
} from '../../core/models/database.types';

export const QUALIFICATION_PILLAR_KEYS: QualificationPillarKey[] = [
  'location',
  'behavior',
  'confirmation',
  'invalidation',
];

export const PILLAR_STEP_KEYS: PillarStepKey[] = [...QUALIFICATION_PILLAR_KEYS, 'outcome'];

const FOCUS_LABELS: Record<PillarFocusTimeframe, string> = {
  M15: '15m',
  M5: '5m',
  M1: '1m',
};

export function pillarFocusLabel(tf: PillarFocusTimeframe): string {
  return FOCUS_LABELS[tf];
}

function emptyPillarJournal(): PillarStepJournal {
  return {
    focus_timeframe: 'M15',
    notes: '',
    note_tags: [],
    screenshots: [],
  };
}

function mapStepToJournal(step: PillarStepFormValue): PillarStepJournal {
  return {
    focus_timeframe: step.focus_timeframe,
    notes: step.notes_content.text.trim(),
    note_tags: step.notes_content.tags,
    screenshots: [],
  };
}

export function mapFormToPillarJournals(form: GatekeeperFormValue): PillarJournalsSnapshot {
  return {
    location: mapStepToJournal(form.location),
    behavior: mapStepToJournal(form.behavior),
    confirmation: mapStepToJournal(form.confirmation),
    invalidation: mapStepToJournal(form.invalidation),
    outcome: mapStepToJournal(form.outcome),
  };
}

export function emptyPillarJournalsSnapshot(): PillarJournalsSnapshot {
  return {
    location: emptyPillarJournal(),
    behavior: emptyPillarJournal(),
    confirmation: emptyPillarJournal(),
    invalidation: emptyPillarJournal(),
    outcome: emptyPillarJournal(),
  };
}

export function formatPillarStepSummary(step: PillarStepKey, journal: PillarStepJournal): string {
  return `${FOCUS_LABELS[journal.focus_timeframe]} · ${journal.notes.slice(0, 40)}${journal.notes.length > 40 ? '…' : ''}`;
}

