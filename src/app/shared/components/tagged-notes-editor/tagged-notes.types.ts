import type { JournalNoteTag } from '../../../core/models/database.types';

export type { JournalNoteTag };

export interface TaggedNotesValue {
  text: string;
  tags: JournalNoteTag[];
}

export interface TaggedNotesSegment {
  type: 'text' | 'tag';
  content: string;
  tagId?: string;
}
