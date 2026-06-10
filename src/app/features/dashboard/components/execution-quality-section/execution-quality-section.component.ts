import { DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardModule } from 'primeng/card';

import type { ProcessGradeStats } from '../../dashboard.types';

@Component({
  selector: 'app-execution-quality-section',
  imports: [DecimalPipe, PercentPipe, CardModule],
  templateUrl: './execution-quality-section.component.html',
  styleUrl: './execution-quality-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutionQualitySectionComponent {
  readonly grades = input.required<ProcessGradeStats[]>();
  readonly avgScore = input.required<number>();
}
