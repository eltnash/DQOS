import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';

import type { AnalyzedTimeframe } from '../../core/models/database.types';
import { ImageAnnotatorDialogComponent } from '../../shared/components/image-annotator-dialog/image-annotator-dialog.component';
import { HtfScreenshotDraftService } from './htf-screenshot-draft.service';
import { timeframeLabel } from './htf-context.utils';

@Component({
  selector: 'app-timeframe-journal-panel',
  imports: [
    ReactiveFormsModule,
    TextareaModule,
    ButtonModule,
    MessageModule,
    ImageAnnotatorDialogComponent,
  ],
  templateUrl: './timeframe-journal-panel.component.html',
  styleUrl: './timeframe-journal-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeframeJournalPanelComponent {
  private readonly screenshotDrafts = inject(HtfScreenshotDraftService);

  readonly timeframe = input.required<AnalyzedTimeframe>();
  readonly journalGroup = input.required<FormGroup>();

  protected readonly annotatorOpen = signal(false);
  protected readonly uploadError = signal<string | null>(null);

  private readonly fileInputRef = viewChild<HTMLInputElement>('fileInputRef');

  protected readonly title = computed(() => `${timeframeLabel(this.timeframe())} chart journal`);

  protected readonly screenshotDraft = computed(() =>
    this.screenshotDrafts.getDraft(this.timeframe()),
  );

  protected openFilePicker(): void {
    this.fileInputRef()?.click();
  }

  protected onScreenshotSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.uploadError.set('Please choose an image file (PNG, JPEG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set('Image must be 5 MB or smaller.');
      return;
    }

    this.uploadError.set(null);
    this.screenshotDrafts.setDraft(this.timeframe(), file);
  }

  protected removeScreenshot(): void {
    this.screenshotDrafts.removeDraft(this.timeframe());
    this.uploadError.set(null);
  }

  protected openAnnotator(): void {
    if (this.screenshotDraft()) {
      this.annotatorOpen.set(true);
    }
  }

  protected closeAnnotator(): void {
    this.annotatorOpen.set(false);
  }

  protected onAnnotatedSaved(file: File): void {
    this.screenshotDrafts.setDraft(this.timeframe(), file, true);
    this.annotatorOpen.set(false);
  }
}
