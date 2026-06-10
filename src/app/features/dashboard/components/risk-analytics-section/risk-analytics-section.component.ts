import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardModule } from 'primeng/card';

import type { RiskAnalytics } from '../../dashboard.types';

@Component({
  selector: 'app-risk-analytics-section',
  imports: [CurrencyPipe, DecimalPipe, CardModule],
  templateUrl: './risk-analytics-section.component.html',
  styleUrl: './risk-analytics-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskAnalyticsSectionComponent {
  readonly risk = input.required<RiskAnalytics>();
  readonly currency = input('USD');
}
