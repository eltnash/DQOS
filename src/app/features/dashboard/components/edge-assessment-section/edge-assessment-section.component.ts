import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import type { StrategyAnalyticsBundle } from '../../dashboard.types';
import {
  SAMPLE_MINIMUM,
  SAMPLE_PRELIMINARY,
  SAMPLE_ROBUST,
  confidenceLabel,
  edgeStatusLabel,
} from '../../trading-metrics.utils';
import { auctionStrategyTagSeverity } from '../../../gatekeeper/auction-playbook.utils';

@Component({
  selector: 'app-edge-assessment-section',
  imports: [CurrencyPipe, DecimalPipe, PercentPipe, CardModule, ProgressBarModule, TagModule, TooltipModule],
  templateUrl: './edge-assessment-section.component.html',
  styleUrl: './edge-assessment-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EdgeAssessmentSectionComponent {
  readonly bundles = input.required<StrategyAnalyticsBundle[]>();
  readonly currency = input('USD');

  protected readonly sampleMin = SAMPLE_MINIMUM;
  protected readonly samplePreliminary = SAMPLE_PRELIMINARY;
  protected readonly sampleRobust = SAMPLE_ROBUST;
  protected readonly statusLabel = edgeStatusLabel;
  protected readonly confidenceLabel = confidenceLabel;
  protected readonly strategySeverity = auctionStrategyTagSeverity;

  protected statusSeverity(
    status: StrategyAnalyticsBundle['edgeAssessment']['edgeStatus'],
  ): 'secondary' | 'danger' | 'warn' | 'success' | 'info' {
    switch (status) {
      case 'insufficient_data':
        return 'secondary';
      case 'no_edge':
        return 'danger';
      case 'possible_edge':
        return 'warn';
      case 'positive_edge':
        return 'info';
      case 'confirmed_edge':
        return 'success';
    }
  }

  protected sampleProgress(count: number): number {
    return Math.min(100, (count / SAMPLE_ROBUST) * 100);
  }

  protected pfDisplay(pf: number | null): string {
    return pf == null ? '∞' : pf.toFixed(2);
  }
}
