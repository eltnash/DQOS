import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TextareaModule } from 'primeng/textarea';

import {
  COMPOSITE_VALUE_POSITION_OPTIONS,
  HTF_ANALYSIS_TOOL_OPTIONS,
  HTF_AUCTION_REGIME_OPTIONS,
} from '../../../core/supabase/enum-options';
import { EnumPillSelectComponent } from '../../../shared/components/enum-pill-select/enum-pill-select.component';
import {
  HTF_NARRATIVE_BRIDGE,
  HTF_NARRATIVE_INTRO,
  HTF_NARRATIVE_TOOLS,
} from '../htf-narrative.content';

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
  readonly narrativeGroup = input.required<FormGroup>();

  protected readonly intro = HTF_NARRATIVE_INTRO;
  protected readonly toolsReference = HTF_NARRATIVE_TOOLS;
  protected readonly bridge = HTF_NARRATIVE_BRIDGE;

  protected readonly compositeVaOptions = COMPOSITE_VALUE_POSITION_OPTIONS;
  protected readonly auctionRegimeOptions = HTF_AUCTION_REGIME_OPTIONS;
  protected readonly toolOptions = HTF_ANALYSIS_TOOL_OPTIONS;

  protected hasAnswer(controlName: string): boolean {
    const control = this.narrativeGroup().get(controlName);
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

  protected clearAnswer(controlName: string): void {
    const group = this.narrativeGroup();
    const control = group.get(controlName);
    if (!control) {
      return;
    }

    if (controlName === 'tools_used') {
      const toolsGroup = control as FormGroup;
      Object.keys(toolsGroup.controls).forEach((key) => {
        toolsGroup.get(key)?.setValue(false);
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
