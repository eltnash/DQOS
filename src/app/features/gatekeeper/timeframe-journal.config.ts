import type { AnalyzedTimeframe } from '../../core/models/database.types';

export interface TimeframeJournalCopy {
  intro: string;
  uploadHint: string;
  notesLabel: string;
  notesPlaceholder: string;
  focusPoints?: readonly string[];
}

const DEFAULT_JOURNAL_COPY: TimeframeJournalCopy = {
  intro: 'Add chart screenshots for this timeframe, describe what you see, and annotate images if needed.',
  uploadHint: 'Drag images here, choose files, or paste from your clipboard. You can add multiple charts per timeframe.',
  notesLabel: 'Notes describing this chart',
  notesPlaceholder:
    'Describe structure, key levels, and how this timeframe sets context for intraday execution…',
};

const WEEKLY_JOURNAL_COPY: TimeframeJournalCopy = {
  intro:
    'Upload your weekly chart with prior week high, prior week low, and prior week composite VAH / VAL / POC marked. Answer the narrative Q&A below for this tab.',
  uploadHint:
    'Upload a weekly chart with prior week high, prior week low, and prior week composite VAH / VAL / POC marked.',
  notesLabel: 'Chart annotation notes',
  notesPlaceholder:
    'Tag key levels visible on the chart — prior week high/low lines, composite POC, structure trend lines…',
};

export const TIMEFRAME_JOURNAL_COPY: Record<AnalyzedTimeframe, TimeframeJournalCopy> = {
  M: {
    ...DEFAULT_JOURNAL_COPY,
    notesPlaceholder:
      'Macro composite profile, major balance boundaries, and value migration that frames the week ahead…',
  },
  W: WEEKLY_JOURNAL_COPY,
  D: {
    ...DEFAULT_JOURNAL_COPY,
    notesPlaceholder:
      'Developing day type, session value, and daily structure feeding into 15m execution…',
  },
  H4: {
    ...DEFAULT_JOURNAL_COPY,
    notesPlaceholder: 'Intermediate structure, rotations, and levels bridging HTF into intraday…',
  },
  H1: {
    ...DEFAULT_JOURNAL_COPY,
    notesPlaceholder: 'Intraday structure into 15m execution — swings, value, and key references…',
  },
};

export function journalCopyForTimeframe(tf: AnalyzedTimeframe): TimeframeJournalCopy {
  return TIMEFRAME_JOURNAL_COPY[tf];
}
