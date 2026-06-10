import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import type { PillarFocusTimeframe, PillarStepKey } from '../../../core/models/database.types';
import { PILLAR_FOCUS_TIMEFRAME_OPTIONS } from '../../../core/supabase/enum-options';
import { EnumPillSelectComponent } from '../../../shared/components/enum-pill-select/enum-pill-select.component';
import { TaggedNotesEditorComponent } from '../../../shared/components/tagged-notes-editor/tagged-notes-editor.component';
import { pillarFocusLabel } from '../pillar-context.utils';
import { readImageFromClipboardEvent } from '../screenshot-upload.utils';
import { JournalScreenshotsPanelComponent } from '../journal-screenshots-panel/journal-screenshots-panel.component';

@Component({
  selector: 'app-pillar-step-panel',
  imports: [
    ReactiveFormsModule,
    EnumPillSelectComponent,
    JournalScreenshotsPanelComponent,
    TaggedNotesEditorComponent,
  ],
  templateUrl: './pillar-step-panel.component.html',
  styleUrl: './pillar-step-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PillarStepPanelComponent {
  readonly stepKey = input.required<PillarStepKey>();
  readonly stepGroup = input.required<FormGroup>();
  readonly stepTitle = input.required<string>();
  readonly notesPlaceholder = input(
    'Describe what you see on this chart for this pillar — tag key levels, behavior, or triggers.',
  );
  readonly pasteActive = input(false);

  protected readonly focusTimeframeOptions = PILLAR_FOCUS_TIMEFRAME_OPTIONS;
  protected readonly focusTimeframe = signal<PillarFocusTimeframe>('M15');

  protected readonly screenshotScope = computed(() => ({
    kind: 'pillar' as const,
    id: this.stepKey(),
  }));

  protected readonly focusLabel = computed(() => pillarFocusLabel(this.focusTimeframe()));

  private readonly screenshotsPanel = viewChild(JournalScreenshotsPanelComponent);

  constructor() {
    effect((onCleanup) => {
      const control = this.stepGroup().get('focus_timeframe');
      if (!control) {
        return;
      }

      this.focusTimeframe.set((control.value as PillarFocusTimeframe | null) ?? 'M15');
      const sub = control.valueChanges.subscribe((value) => {
        this.focusTimeframe.set((value as PillarFocusTimeframe | null) ?? 'M15');
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

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
