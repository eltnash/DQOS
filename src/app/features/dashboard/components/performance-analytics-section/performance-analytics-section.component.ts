import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardModule } from 'primeng/card';

import type { RollingMetricPoint, SeriesPoint } from '../../dashboard.types';
import { DashboardBarChartComponent } from '../shared/bar-chart.component';
import { DashboardLineChartComponent } from '../shared/line-chart.component';

@Component({
  selector: 'app-performance-analytics-section',
  imports: [CardModule, DashboardLineChartComponent, DashboardBarChartComponent],
  templateUrl: './performance-analytics-section.component.html',
  styleUrl: './performance-analytics-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerformanceAnalyticsSectionComponent {
  readonly strategyLabel = input.required<string>();
  readonly strategyPnlCurve = input.required<SeriesPoint[]>();
  readonly accountEquityCurve = input<SeriesPoint[]>([]);
  readonly cumulativeR = input.required<SeriesPoint[]>();
  readonly monthlyPerformance = input.required<SeriesPoint[]>();
  readonly rollingExpectancy = input.required<RollingMetricPoint[]>();
  readonly rollingProfitFactor = input.required<RollingMetricPoint[]>();
  readonly rollingWinRate = input.required<RollingMetricPoint[]>();
}
