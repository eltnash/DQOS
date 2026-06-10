import { DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

import type { EdgePatternRow } from '../../dashboard.types';
import { confidenceLabel } from '../../trading-metrics.utils';

@Component({
  selector: 'app-edge-discovery-section',
  imports: [DecimalPipe, PercentPipe, TagModule],
  templateUrl: './edge-discovery-section.component.html',
  styleUrl: './edge-discovery-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EdgeDiscoverySectionComponent {
  readonly patterns = input.required<EdgePatternRow[]>();
  protected readonly confidenceLabel = confidenceLabel;
}
