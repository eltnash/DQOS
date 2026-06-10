import { DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';

import type { SetupAnalyticsRow } from '../../dashboard.types';
import { confidenceLabel, edgeStatusLabel } from '../../trading-metrics.utils';

type DimFilter = 'all' | SetupAnalyticsRow['dimension'];

@Component({
  selector: 'app-setup-analytics-section',
  imports: [DecimalPipe, PercentPipe, SelectButtonModule, TagModule, FormsModule],
  templateUrl: './setup-analytics-section.component.html',
  styleUrl: './setup-analytics-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupAnalyticsSectionComponent {
  readonly rows = input.required<SetupAnalyticsRow[]>();

  protected readonly filter = signal<DimFilter>('all');
  protected readonly filterOptions = [
    { label: 'All', value: 'all' as DimFilter },
    { label: 'Location', value: 'location' as DimFilter },
    { label: 'Behavior', value: 'behavior' as DimFilter },
    { label: 'Confirmation', value: 'confirmation' as DimFilter },
    { label: 'Day type', value: 'day_type' as DimFilter },
  ];

  protected readonly filtered = computed(() => {
    const f = this.filter();
    const list = this.rows();
    return f === 'all' ? list : list.filter((r) => r.dimension === f);
  });

  protected readonly statusLabel = edgeStatusLabel;
  protected readonly confidenceLabel = confidenceLabel;
}
