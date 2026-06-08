import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { ImageAnnotatorDialogComponent } from '../../../shared/components/image-annotator-dialog/image-annotator-dialog.component';
import { GatekeeperDraftService } from '../gatekeeper-draft.service';
import {
  GatekeeperScreenshotDraftService,
  type JournalScreenshotItem,
  type JournalScreenshotScope,
} from '../gatekeeper-screenshot-draft.service';
import {
  normalizeScreenshotFile,
  readClipboardImageFile,
  validateScreenshotFile,
} from '../screenshot-upload.utils';

@Component({
  selector: 'app-journal-screenshots-panel',
  imports: [ButtonModule, MessageModule, ImageAnnotatorDialogComponent],
  templateUrl: './journal-screenshots-panel.component.html',
  styleUrl: './journal-screenshots-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalScreenshotsPanelComponent {
  private readonly screenshotDrafts = inject(GatekeeperScreenshotDraftService);
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly scope = input.required<JournalScreenshotScope>();
  readonly fileInputId = input.required<string>();
  readonly title = input('Chart screenshots');
  readonly uploadHint = input(
    'Drag images here, choose files, or paste from your clipboard. You can add multiple charts.',
  );

  protected readonly annotatorOpen = signal(false);
  protected readonly annotatingItemId = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly pasting = signal(false);
  protected readonly dragging = signal(false);

  protected readonly screenshotItems = computed((): JournalScreenshotItem[] => {
    this.screenshotDrafts.revisionSnapshot();
    return this.screenshotDrafts.getItems(this.scope());
  });

  protected readonly annotatingItem = computed((): JournalScreenshotItem | null => {
    const itemId = this.annotatingItemId();
    if (!itemId) {
      return null;
    }
    return this.screenshotItems().find((item) => item.id === itemId) ?? null;
  });

  handlePaste(file: File): boolean {
    return this.applyScreenshotFile(file);
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
    if (files.length > 0) {
      this.applyScreenshotFiles(files);
    }
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
        'No image on clipboard. Take a screenshot (⌘⇧4), or copy an image in Preview, then try again.',
      );
    } finally {
      this.pasting.set(false);
      this.cdr.markForCheck();
    }
  }

  protected removeScreenshot(itemId: string): void {
    const removed = this.screenshotDrafts.removeItem(this.scope(), itemId);
    if (this.annotatingItemId() === itemId) {
      this.closeAnnotator();
    }
    if (removed?.storagePath) {
      void this.draftService.removePersistedScreenshot(this.scope(), removed.storagePath).catch((err) => {
        this.setUploadError(err instanceof Error ? err.message : 'Could not remove saved screenshot');
      });
    }
    this.setUploadError(null);
  }

  protected openAnnotator(itemId: string): void {
    if (this.screenshotDrafts.getItem(this.scope(), itemId)) {
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

    const existing = this.screenshotDrafts.getItem(this.scope(), itemId);
    this.screenshotDrafts.updateItem(this.scope(), itemId, file, true);
    this.closeAnnotator();

    void this.persistAnnotatedScreenshot(itemId, file, existing?.storagePath).finally(() => {
      this.cdr.markForCheck();
    });
  }

  private async persistAnnotatedScreenshot(
    itemId: string,
    file: File,
    previousStoragePath?: string,
  ): Promise<void> {
    try {
      let ref;
      if (previousStoragePath) {
        ref = await this.draftService.replacePersistedScreenshot(this.scope(), previousStoragePath, file);
      } else {
        ref = await this.draftService.persistScreenshot(this.scope(), itemId, file, true);
      }
      const previewUrl = await this.draftService.createSignedPreviewUrl(ref.storage_path);
      this.screenshotDrafts.markItemPersisted(this.scope(), itemId, ref, previewUrl);
      this.setUploadError(null);
    } catch (err) {
      this.setUploadError(err instanceof Error ? err.message : 'Could not save annotated screenshot');
    }
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
    const prefix = `${this.scope().kind}-${this.scope().id}-chart`;
    const normalized = normalizeScreenshotFile(file, prefix);
    const error = validateScreenshotFile(normalized);
    if (error) {
      this.setUploadError(error);
      return false;
    }

    const itemId = this.screenshotDrafts.addItem(this.scope(), normalized);
    void this.uploadScreenshot(itemId, normalized).finally(() => {
      if (markForCheck) {
        this.cdr.markForCheck();
      }
    });

    if (markForCheck) {
      this.setUploadError(null);
      this.cdr.markForCheck();
    }
    return true;
  }

  private async uploadScreenshot(itemId: string, file: File): Promise<void> {
    try {
      const ref = await this.draftService.persistScreenshot(this.scope(), itemId, file, false);
      const previewUrl = await this.draftService.createSignedPreviewUrl(ref.storage_path);
      this.screenshotDrafts.markItemPersisted(this.scope(), itemId, ref, previewUrl);
      this.setUploadError(null);
    } catch (err) {
      this.screenshotDrafts.removeItem(this.scope(), itemId);
      this.setUploadError(err instanceof Error ? err.message : 'Could not save screenshot');
    }
  }

  private setUploadError(message: string | null): void {
    this.uploadError.set(message);
    this.cdr.markForCheck();
  }
}
