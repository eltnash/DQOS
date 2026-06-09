import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

import type { GatekeeperStepTabItem } from './gatekeeper-step-tabs.types';

@Component({
  selector: 'app-gatekeeper-step-tabs',
  imports: [TooltipModule],
  templateUrl: './gatekeeper-step-tabs.component.html',
  styleUrl: './gatekeeper-step-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatekeeperStepTabsComponent {
  readonly steps = input.required<GatekeeperStepTabItem[]>();
  readonly interactive = input(true);
  readonly ariaLabel = input('Gatekeeper steps');

  readonly stepSelect = output<number>();

  protected onTabClick(step: GatekeeperStepTabItem): void {
    if (!this.interactive() || step.locked) {
      return;
    }

    this.stepSelect.emit(step.number);
  }
}
