import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TextareaModule } from 'primeng/textarea';

import type { AnalyzedTimeframe } from '../../../core/models/database.types';
import {
  COMPOSITE_VALUE_POSITION_OPTIONS,
  HTF_AUCTION_REGIME_OPTIONS,
  HTF_ANALYSIS_TOOL_OPTIONS,
  PRIOR_WEEK_RANGE_OPTIONS,
} from '../../../core/supabase/enum-options';
import { EnumPillSelectComponent } from '../../../shared/components/enum-pill-select/enum-pill-select.component';
import {
  timeframeNarrativeConfig,
  type TimeframeNarrativeFieldConfig,
  type TimeframeNarrativeFieldKey,
} from '../htf-timeframe-narrative.config';
import { timeframeLabel } from '../htf-context.utils';

@Component({
  selector: 'app-htf-narrative-panel',
  imports: [
    ReactiveFormsModule,
    TextareaModule,
    ButtonModule,
    CheckboxModule,
    EnumPillSelectComponent,
  ],
  templateUrl: './htf-narrative-panel.component.html',
  styleUrl: './htf-narrative-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HtfNarrativePanelComponent {
  readonly timeframe = input.required<AnalyzedTimeframe>();
  readonly narrativeGroup = input.required<FormGroup>();

  protected readonly config = computed(() => timeframeNarrativeConfig(this.timeframe()));
  protected readonly timeframeTitle = computed(() => timeframeLabel(this.timeframe()));

  protected readonly compositeVaOptions = COMPOSITE_VALUE_POSITION_OPTIONS;
  protected readonly auctionRegimeOptions = HTF_AUCTION_REGIME_OPTIONS;
  protected readonly priorWeekRangeOptions = PRIOR_WEEK_RANGE_OPTIONS;

  protected readonly toolOptions = computed(() => {
    const config = this.config();
    const allowed = new Set(config.toolKeys);

    return HTF_ANALYSIS_TOOL_OPTIONS.filter((tool) => allowed.has(tool.key)).map((tool) => {
      const override = config.toolLabels[tool.key];
      return {
        key: tool.key,
        label: override?.label ?? tool.label,
        hint: override?.hint ?? tool.hint,
      };
    });
  });

  protected fieldInputId(field: TimeframeNarrativeFieldConfig): string {
    return `htf-${this.timeframe()}-${field.key}`;
  }

  protected hasAnswer(key: TimeframeNarrativeFieldKey): boolean {
    const control = this.narrativeGroup().get(key);
    if (!control) {
      return false;
    }

    const value = control.value;
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return value != null;
  }

  protected hasAnyToolSelected(): boolean {
    const group = this.narrativeGroup().get('tools_used') as FormGroup | null;
    if (!group) {
      return false;
    }
    return Object.values(group.controls).some((control) => control.value === true);
  }

  protected clearAnswer(key: TimeframeNarrativeFieldKey): void {
    const group = this.narrativeGroup();
    const control = group.get(key);
    if (!control) {
      return;
    }

    if (key === 'tools_used') {
      const toolsGroup = control as FormGroup;
      Object.keys(toolsGroup.controls).forEach((toolKey) => {
        toolsGroup.get(toolKey)?.setValue(false);
      });
    } else if (typeof control.value === 'string') {
      control.setValue('');
    } else {
      control.setValue(null);
    }

    control.markAsDirty();
    control.markAsTouched();
    group.updateValueAndValidity();
  }

  protected clearTools(): void {
    this.clearAnswer('tools_used');
  }
}
