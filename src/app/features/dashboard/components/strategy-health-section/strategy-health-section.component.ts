import { DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

import type { StrategyHealth } from '../../dashboard.types';
import { healthStatusLabel } from '../../trading-metrics.utils';

@Component({
  selector: 'app-strategy-health-section',
  imports: [DecimalPipe, PercentPipe, CardModule, TagModule],
  templateUrl: './strategy-health-section.component.html',
  styleUrl: './strategy-health-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategyHealthSectionComponent {
  readonly health = input.required<StrategyHealth>();
  readonly strategyLabel = input.required<string>();
  protected readonly statusLabel = healthStatusLabel;

  protected severity(status: StrategyHealth['status']): 'success' | 'info' | 'warn' | 'danger' {
    switch (status) {
      case 'growing_edge':
        return 'success';
      case 'stable_edge':
        return 'info';
      case 'deteriorating_edge':
        return 'warn';
      case 'no_edge':
        return 'danger';
    }
  }
}
