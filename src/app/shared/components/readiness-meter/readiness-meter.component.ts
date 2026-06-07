import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KnobModule } from 'primeng/knob';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';

import { readinessPctFromCompleted, type PillarStepState } from './readiness-meter.types';

@Component({
  selector: 'app-readiness-meter',
  imports: [FormsModule, KnobModule, ProgressBarModule, MessageModule],
  templateUrl: './readiness-meter.component.html',
  styleUrl: './readiness-meter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadinessMeterComponent {
  readonly pillarSteps = input.required<PillarStepState[]>();
  readonly isRetest = input(false);
  readonly compact = input(false);

  protected readonly completedSteps = computed(
    () => this.pillarSteps().filter((step) => step.valid).length,
  );

  protected readonly readinessPct = computed(() =>
    readinessPctFromCompleted(this.completedSteps()),
  );

  protected readonly pillarsQualified = computed(() => this.readinessPct() === 100);

  protected readonly bannerSeverity = computed(() =>
    this.pillarsQualified() ? 'success' : 'warn',
  );

  protected readonly bannerText = computed(() => {
    if (this.pillarsQualified()) {
      return 'STRATEGY FULLY QUALIFIED — execution unlocked';
    }
    if (!this.isRetest()) {
      return 'STRATEGY NOT FULLY QUALIFIED — DO NOT TRADE (retest required)';
    }
    return 'STRATEGY NOT FULLY QUALIFIED — DO NOT TRADE';
  });
}
