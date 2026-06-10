import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';

import type { JournalNoteTag, TaggedNotesValue } from './tagged-notes.types';
import {
  EMPTY_TAGGED_NOTES,
  normalizeSelectionTag,
  persistTagsOnEdit,
  segmentsFromTaggedNotes,
  tagOverlapsSelection,
} from './tagged-notes.utils';

@Component({
  selector: 'app-tagged-notes-editor',
  imports: [TextareaModule],
  templateUrl: './tagged-notes-editor.component.html',
  styleUrl: './tagged-notes-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TaggedNotesEditorComponent),
      multi: true,
    },
  ],
})
export class TaggedNotesEditorComponent implements ControlValueAccessor, AfterViewInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  readonly inputId = input('tagged-notes');
  readonly placeholder = input(
    'Describe composite profile, key levels, unfinished business, day type, and how this timeframe sets context for 15m execution...',
  );

  protected readonly selectionRange = signal<{ start: number; end: number } | null>(null);
  protected readonly tagError = signal<string | null>(null);

  protected readonly state = signal<TaggedNotesValue>(EMPTY_TAGGED_NOTES);
  protected disabled = false;

  private syncingTextarea = false;
  private onChange: (value: TaggedNotesValue) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly hasSelection = computed(() => {
    const range = this.selectionRange();
    return range != null && range.end > range.start;
  });

  protected readonly selectedPreview = computed(() => {
    const range = this.selectionRange();
    if (!range || range.end <= range.start) {
      return '';
    }
    return normalizeSelectionTag(this.state().text, range.start, range.end)?.label ?? '';
  });

  protected readonly previewSegments = computed(() => segmentsFromTaggedNotes(this.state()));

  ngAfterViewInit(): void {
    this.syncTextareaValue(this.state().text);
  }

  protected onTextInput(event: Event): void {
    if (this.syncingTextarea) {
      return;
    }

    const textarea = event.target as HTMLTextAreaElement;
    const text = textarea.value;
    const tags = persistTagsOnEdit(text, this.state().tags);
    this.updateValue({ text, tags }, false);
    this.captureSelection(textarea);
  }

  protected onSelectionChange(): void {
    const textarea = this.textareaRef()?.nativeElement;
    if (!textarea) {
      return;
    }
    this.captureSelection(textarea);
    this.tagError.set(null);
  }

  protected tagSelection(): void {
    if (this.disabled) {
      return;
    }

    const range = this.selectionRange();
    const textarea = this.textareaRef()?.nativeElement;
    if (!range || !textarea) {
      this.tagError.set('Select the words or sentence you want to tag first.');
      return;
    }

    const normalized = normalizeSelectionTag(this.state().text, range.start, range.end);
    if (!normalized) {
      this.tagError.set('Selection is empty.');
      return;
    }

    const duplicate = this.state().tags.some(
      (tag) => tag.label.toLowerCase() === normalized.label.toLowerCase(),
    );
    if (duplicate) {
      this.tagError.set('That tag already exists.');
      return;
    }

    if (tagOverlapsSelection(this.state().tags, normalized.start, normalized.end)) {
      this.tagError.set('That text is already tagged.');
      return;
    }

    const tag: JournalNoteTag = {
      id: crypto.randomUUID(),
      label: normalized.label,
      start: normalized.start,
      end: normalized.end,
    };

    this.tagError.set(null);
    this.updateValue({
      text: this.state().text,
      tags: [...this.state().tags, tag].sort((a, b) => a.start - b.start),
    });
    this.selectionRange.set(null);
    this.onTouched();
    textarea.focus();
  }

  protected removeTag(tagId: string): void {
    if (this.disabled) {
      return;
    }
    this.updateValue({
      text: this.state().text,
      tags: this.state().tags.filter((tag) => tag.id !== tagId),
    });
    this.onTouched();
  }

  protected onBlur(): void {
    this.onTouched();
  }

  writeValue(value: TaggedNotesValue | null): void {
    const text = value?.text ?? '';
    const next = {
      text,
      tags: persistTagsOnEdit(text, value?.tags ?? []),
    };

    if (next.text === this.state().text && tagsEqual(next.tags, this.state().tags)) {
      return;
    }

    this.state.set(next);
    this.syncTextareaValue(next.text);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: TaggedNotesValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  private updateValue(value: TaggedNotesValue, syncTextarea = true): void {
    const next = {
      text: value.text,
      tags: persistTagsOnEdit(value.text, value.tags),
    };
    this.state.set(next);
    if (syncTextarea) {
      this.syncTextareaValue(next.text);
    }
    this.onChange(next);
    this.cdr.markForCheck();
  }

  private syncTextareaValue(text: string): void {
    const textarea = this.textareaRef()?.nativeElement;
    if (!textarea || textarea.value === text) {
      return;
    }

    this.syncingTextarea = true;
    textarea.value = text;
    this.syncingTextarea = false;
  }

  private captureSelection(textarea: HTMLTextAreaElement): void {
    this.selectionRange.set({
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
  }
}

function tagsEqual(left: JournalNoteTag[], right: JournalNoteTag[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((tag, index) => {
    const other = right[index];
    return (
      tag.id === other.id &&
      tag.label === other.label &&
      tag.start === other.start &&
      tag.end === other.end
    );
  });
}
