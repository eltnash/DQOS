import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AccordionModule } from 'primeng/accordion';

import { KPI_DEFINITIONS } from '../../kpi-definitions';

@Component({
  selector: 'app-kpi-glossary-section',
  imports: [AccordionModule],
  templateUrl: './kpi-glossary-section.component.html',
  styleUrl: './kpi-glossary-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiGlossarySectionComponent {
  protected readonly definitions = KPI_DEFINITIONS;
}
