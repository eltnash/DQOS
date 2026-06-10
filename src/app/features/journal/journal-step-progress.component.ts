import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ProgressBarModule } from 'primeng/progressbar';

import { GatekeeperStepTabsComponent } from '../gatekeeper/gatekeeper-step-tabs/gatekeeper-step-tabs.component';
import type { GatekeeperStepProgress } from '../gatekeeper/gatekeeper-step-progress.utils';

@Component({
  selector: 'app-journal-step-progress',
  imports: [ProgressBarModule, GatekeeperStepTabsComponent],
  templateUrl: './journal-step-progress.component.html',
  styleUrl: './journal-step-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalStepProgressComponent {
  readonly progress = input.required<GatekeeperStepProgress>();

  protected readonly tabSteps = computed(() =>
    this.progress().steps.map((step) => ({
      number: step.number,
      label: step.label,
      complete: step.complete,
      current: step.current,
    })),
  );
}
