import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  input,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import type { AnalyzedTimeframe } from '../../core/models/database.types';
import { TaggedNotesEditorComponent } from '../../shared/components/tagged-notes-editor/tagged-notes-editor.component';
import type { JournalScreenshotScope } from './gatekeeper-screenshot-draft.service';
import { JournalScreenshotsPanelComponent } from './journal-screenshots-panel/journal-screenshots-panel.component';
import { timeframeLabel } from './htf-context.utils';
import { journalCopyForTimeframe } from './timeframe-journal.config';
import { readImageFromClipboardEvent } from './screenshot-upload.utils';

@Component({
  selector: 'app-timeframe-journal-panel',
  imports: [ReactiveFormsModule, JournalScreenshotsPanelComponent, TaggedNotesEditorComponent],
  templateUrl: './timeframe-journal-panel.component.html',
  styleUrl: './timeframe-journal-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeframeJournalPanelComponent {
  readonly timeframe = input.required<AnalyzedTimeframe>();
  readonly journalGroup = input.required<FormGroup>();
  readonly pasteActive = input(false);

  protected readonly title = computed(() => `${timeframeLabel(this.timeframe())} chart journal`);
  protected readonly copy = computed(() => journalCopyForTimeframe(this.timeframe()));
  protected readonly screenshotScope = computed(
    (): JournalScreenshotScope => ({ kind: 'htf', id: this.timeframe() }),
  );

  private readonly screenshotsPanel = viewChild(JournalScreenshotsPanelComponent);

  @HostListener('document:paste', ['$event'])
  protected onDocumentPaste(event: ClipboardEvent): void {
    if (!this.pasteActive()) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement && target.closest('textarea, input:not([type=file]), [contenteditable="true"]')) {
      return;
    }

    const file = readImageFromClipboardEvent(event);
    if (!file) {
      return;
    }

    event.preventDefault();
    this.screenshotsPanel()?.handlePaste(file);
  }
}
