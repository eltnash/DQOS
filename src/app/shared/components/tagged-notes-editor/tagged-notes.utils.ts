import type { JournalNoteTag, TaggedNotesSegment, TaggedNotesValue } from './tagged-notes.types';

export const EMPTY_TAGGED_NOTES: TaggedNotesValue = { text: '', tags: [] };

export function taggedNotesPlainText(value: TaggedNotesValue | null | undefined): string {
  return value?.text?.trim() ?? '';
}

export function taggedNotesTagLabels(value: TaggedNotesValue | null | undefined): string[] {
  return (value?.tags ?? []).map((tag) => tag.label);
}

/** Flat list for future AI / search indexing. */
export function taggedNotesSearchIndex(value: TaggedNotesValue | null | undefined): string[] {
  const plain = taggedNotesPlainText(value);
  const tags = taggedNotesTagLabels(value);
  return plain ? [plain, ...tags] : tags;
}

/** Keep every tag; refresh highlight positions when the label still appears in the text. */
export function persistTagsOnEdit(text: string, tags: JournalNoteTag[]): JournalNoteTag[] {
  const occupied: Array<{ start: number; end: number }> = [];

  return tags.map((tag) => {
    const anchored = findTagAnchor(text, tag, occupied);
    if (anchored) {
      occupied.push({ start: anchored.start, end: anchored.end });
      return anchored;
    }

    return { ...tag, start: -1, end: -1 };
  });
}

export function normalizeSelectionTag(
  text: string,
  start: number,
  end: number,
): { label: string; start: number; end: number } | null {
  const raw = text.slice(start, end);
  const label = raw.trim();
  if (!label) {
    return null;
  }

  const labelStart = start + raw.indexOf(label);
  return {
    label,
    start: labelStart,
    end: labelStart + label.length,
  };
}

export function segmentsFromTaggedNotes(value: TaggedNotesValue): TaggedNotesSegment[] {
  const text = value.text;
  const tags = [...value.tags]
    .filter((tag) => tag.start >= 0 && tag.end > tag.start && tag.end <= text.length)
    .sort((a, b) => a.start - b.start);

  const segments: TaggedNotesSegment[] = [];
  let cursor = 0;

  for (const tag of tags) {
    if (tag.start < cursor) {
      continue;
    }

    if (tag.start > cursor) {
      segments.push({ type: 'text', content: text.slice(cursor, tag.start) });
    }

    segments.push({
      type: 'tag',
      content: text.slice(tag.start, tag.end),
      tagId: tag.id,
    });
    cursor = tag.end;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', content: text.slice(cursor) });
  }

  return segments;
}

export function tagOverlapsSelection(
  tags: JournalNoteTag[],
  start: number,
  end: number,
  excludeId?: string,
): boolean {
  return tags.some((tag) => {
    if (excludeId && tag.id === excludeId) {
      return false;
    }
    if (tag.start < 0 || tag.end < 0) {
      return false;
    }
    return start < tag.end && end > tag.start;
  });
}

function findTagAnchor(
  text: string,
  tag: JournalNoteTag,
  occupied: Array<{ start: number; end: number }>,
): JournalNoteTag | null {
  const searchFrom = tag.start >= 0 ? Math.max(0, tag.start - 12) : 0;
  let idx = text.indexOf(tag.label, searchFrom);

  if (idx < 0 && searchFrom > 0) {
    idx = text.indexOf(tag.label);
  }

  while (idx >= 0) {
    const end = idx + tag.label.length;
    const overlaps = occupied.some((range) => idx < range.end && end > range.start);
    if (!overlaps) {
      return { ...tag, start: idx, end };
    }
    idx = text.indexOf(tag.label, idx + 1);
  }

  return null;
}
