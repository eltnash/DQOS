import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import type { AnalyzedTimeframe } from '../../core/models/database.types';
import { ImageAnnotatorDialogComponent } from '../../shared/components/image-annotator-dialog/image-annotator-dialog.component';
import { TaggedNotesEditorComponent } from '../../shared/components/tagged-notes-editor/tagged-notes-editor.component';
import type { HtfScreenshotItem } from './htf-screenshot-draft.service';
import { HtfScreenshotDraftService } from './htf-screenshot-draft.service';
import { timeframeLabel } from './htf-context.utils';
import {
  normalizeScreenshotFile,
  readClipboardImageFile,
  readImageFromClipboardEvent,
  validateScreenshotFile,
} from './screenshot-upload.utils';

@Component({
  selector: 'app-timeframe-journal-panel',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    MessageModule,
    ImageAnnotatorDialogComponent,
    TaggedNotesEditorComponent,
  ],
  templateUrl: './timeframe-journal-panel.component.html',
  styleUrl: './timeframe-journal-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeframeJournalPanelComponent {
  private readonly screenshotDrafts = inject(HtfScreenshotDraftService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly timeframe = input.required<AnalyzedTimeframe>();
  readonly journalGroup = input.required<FormGroup>();

  protected readonly annotatorOpen = signal(false);
  protected readonly annotatingItemId = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly pasting = signal(false);
  protected readonly dragging = signal(false);

  protected readonly title = computed(() => `${timeframeLabel(this.timeframe())} chart journal`);
  protected readonly fileInputId = computed(() => `screenshot-file-${this.timeframe()}`);

  protected readonly screenshotItems = computed((): HtfScreenshotItem[] => {
    this.screenshotDrafts.revisionSnapshot();
    return this.screenshotDrafts.getItems(this.timeframe());
  });

  protected readonly annotatingItem = computed((): HtfScreenshotItem | null => {
    const itemId = this.annotatingItemId();
    if (!itemId) {
      return null;
    }
    return this.screenshotItems().find((item) => item.id === itemId) ?? null;
  });

  /** Paste screenshots with ⌘V anywhere on the page while this panel is open (not in notes). */
  @HostListener('document:paste', ['$event'])
  protected onDocumentPaste(event: ClipboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('textarea, input:not([type=file]), [contenteditable="true"]')) {
      return;
    }

    const file = readImageFromClipboardEvent(event);
    if (!file) {
      return;
    }

    event.preventDefault();
    this.applyScreenshotFile(file);
  }

  protected openFilePicker(): void {
    const input = this.fileInputRef()?.nativeElement;
    if (!input) {
      this.setUploadError('File picker is not ready — refresh the page and try again.');
      return;
    }

    input.value = '';
    input.click();
  }

  protected onScreenshotSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';

    if (files.length === 0) {
      return;
    }

    this.applyScreenshotFiles(files);
  }

  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    const related = event.relatedTarget as Node | null;
    const zone = event.currentTarget as HTMLElement;
    if (related && zone.contains(related)) {
      return;
    }
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);

    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
    const imageFiles = files.filter((file) => file.type.startsWith('image/') || !file.type);
    if (imageFiles.length > 0) {
      this.applyScreenshotFiles(imageFiles);
      return;
    }

    this.setUploadError('Drop PNG, JPEG, or WebP image files.');
  }

  protected async pasteFromClipboard(): Promise<void> {
    if (this.pasting()) {
      return;
    }

    this.pasting.set(true);
    this.setUploadError(null);

    try {
      const file = await readClipboardImageFile();
      if (file) {
        this.applyScreenshotFile(file);
        return;
      }

      this.setUploadError(
        'No image on clipboard. Take a screenshot (⌘⇧4), or copy an image in Preview, then click Paste screenshot again.',
      );
    } finally {
      this.pasting.set(false);
      this.cdr.markForCheck();
    }
  }

  protected removeScreenshot(itemId: string): void {
    this.screenshotDrafts.removeItem(this.timeframe(), itemId);
    if (this.annotatingItemId() === itemId) {
      this.closeAnnotator();
    }
    this.setUploadError(null);
  }

  protected openAnnotator(itemId: string): void {
    if (this.screenshotDrafts.getItem(this.timeframe(), itemId)) {
      this.annotatingItemId.set(itemId);
      this.annotatorOpen.set(true);
    }
  }

  protected closeAnnotator(): void {
    this.annotatorOpen.set(false);
    this.annotatingItemId.set(null);
  }

  protected onAnnotatedSaved(file: File): void {
    const itemId = this.annotatingItemId();
    if (!itemId) {
      return;
    }
    this.screenshotDrafts.updateItem(this.timeframe(), itemId, file, true);
    this.closeAnnotator();
    this.cdr.markForCheck();
  }

  private applyScreenshotFiles(files: File[]): void {
    let added = 0;
    for (const file of files) {
      if (this.applyScreenshotFile(file, false)) {
        added += 1;
      }
    }
    if (added > 0) {
      this.setUploadError(null);
      this.cdr.markForCheck();
    }
  }

  private applyScreenshotFile(file: File, markForCheck = true): boolean {
    const normalized = normalizeScreenshotFile(file, `${this.timeframe()}-chart`);
    const error = validateScreenshotFile(normalized);
    if (error) {
      this.setUploadError(error);
      return false;
    }

    this.screenshotDrafts.addItem(this.timeframe(), normalized);
    if (markForCheck) {
      this.setUploadError(null);
      this.cdr.markForCheck();
    }
    return true;
  }

  private setUploadError(message: string | null): void {
    this.uploadError.set(message);
    this.cdr.markForCheck();
  }
}
