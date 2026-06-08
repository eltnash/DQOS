import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';

import type { AnalyzedTimeframe, DayType, PillarStepKey } from '../../core/models/database.types';
import {
  ANALYZED_TIMEFRAME_KEYS,
  ANALYZED_TIMEFRAME_OPTIONS,
  DAY_TYPE_OPTIONS,
} from '../../core/supabase/enum-options';
import { EnumPillSelectComponent } from '../../shared/components/enum-pill-select/enum-pill-select.component';
import {
  readinessPctFromCompleted,
  type PillarStepState,
} from '../../shared/components/readiness-meter/readiness-meter.types';
import {
  dayTypeLabel,
  getPlaybookBehaviorOptions,
  getPlaybookConfirmationOptions,
  getPlaybookLocationOptions,
  invalidationPlaceholder,
  playbookDescription,
  playbookForDayType,
  playbookLabel,
  type AuctionPlaybook,
} from './auction-playbook.utils';
import { createGatekeeperForm, syncGatekeeperFormValidators } from './gatekeeper-form.factory';
import type { ExecutionPillarStepKey, GatekeeperFormValue, GatekeeperStepKey } from './gatekeeper-form.types';
import { GatekeeperDraftService } from './gatekeeper-draft.service';
import type { GatekeeperDraftLoadResult, GatekeeperDraftMedia } from './gatekeeper-draft.types';
import { GatekeeperScreenshotDraftService } from './gatekeeper-screenshot-draft.service';
import {
  EXECUTION_TIMEFRAME,
  formatHtfContextSummary,
  mapFormToHtfContext,
  timeframeLabel,
} from './htf-context.utils';
import { PillarStepPanelComponent } from './pillar-step-panel/pillar-step-panel.component';
import { pillarFocusLabel } from './pillar-context.utils';
import { HtfNarrativePanelComponent } from './htf-narrative-panel/htf-narrative-panel.component';
import { TimeframeJournalPanelComponent } from './timeframe-journal-panel.component';

interface WizardStepMeta {
  key: GatekeeperStepKey;
  number: number;
  title: string;
  methodology: string;
}

const PILLAR_STEP_LABELS: Record<ExecutionPillarStepKey, string> = {
  location: 'Location',
  behavior: 'Behavior',
  confirmation: 'Confirmation',
  invalidation: 'Invalidation',
};

/** During development all steps stay clickable; set false for sequential unlock. */
const WIZARD_UNLOCK_ALL_STEPS = true;

@Component({
  selector: 'app-gatekeeper-wizard',
  imports: [
    ReactiveFormsModule,
    TimeframeJournalPanelComponent,
    HtfNarrativePanelComponent,
    PillarStepPanelComponent,
    EnumPillSelectComponent,
    CheckboxModule,
    InputNumberModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    TagModule,
  ],
  templateUrl: './gatekeeper-wizard.component.html',
  styleUrl: './gatekeeper-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatekeeperWizardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly screenshotDrafts = inject(GatekeeperScreenshotDraftService);
  private readonly draftService = inject(GatekeeperDraftService);

  readonly pillarsChange = output<{
    pillarSteps: PillarStepState[];
    pillarsQualified: boolean;
    isRetest: boolean;
    formValue: GatekeeperFormValue | null;
  }>();

  protected readonly form = createGatekeeperForm(this.fb);
  protected readonly activeStep = signal(1);
  protected readonly activeTimeframeTab = signal<AnalyzedTimeframe>('W');
  protected readonly executionTimeframe = EXECUTION_TIMEFRAME;

  protected readonly timeframeOptions = ANALYZED_TIMEFRAME_OPTIONS;
  protected readonly timeframeKeys = ANALYZED_TIMEFRAME_KEYS;
  protected readonly dayTypeOptions = DAY_TYPE_OPTIONS;

  protected readonly playbookLabel = playbookLabel;
  protected readonly playbookDescription = playbookDescription;
  protected readonly dayTypeLabel = dayTypeLabel;

  protected readonly draftSaveStatus = this.draftService.status;

  protected readonly steps: WizardStepMeta[] = [
    {
      key: 'context',
      number: 1,
      title: 'HTF Context',
      methodology:
        'Select timeframes, journal charts for each tab, then complete that timeframe\'s narrative Q&A before continuing.',
    },
    {
      key: 'auction_type',
      number: 2,
      title: 'Auction Type',
      methodology:
        'Read the developing volume profile shape — you don\'t need the final day type at the open. Is the auction rotating around value (balance) or migrating directionally (trend)? Your choice sets the playbook for the pillars below.',
    },
    {
      key: 'location',
      number: 3,
      title: 'Location',
      methodology:
        'Choose your chart focus (15m, 5m, or 1m). Pick a location aligned with today\'s auction type and playbook — profile edge for fades, pullback zone for trends.',
    },
    {
      key: 'behavior',
      number: 4,
      title: 'Behavior',
      methodology:
        'How is price behaving at your location on the chosen LTF chart? Options reflect your auction playbook — rejection/rotation for fades, acceptance/migration for trends.',
    },
    {
      key: 'confirmation',
      number: 5,
      title: 'Confirmation',
      methodology:
        'Validate participation at the retest with order flow signatures suited to your playbook.',
    },
    {
      key: 'invalidation',
      number: 6,
      title: 'Invalidation',
      methodology:
        'Where is the thesis objectively dead? Fade setups fail on acceptance beyond the edge; trend setups fail on acceptance back inside prior value.',
    },
  ];

  protected readonly stepCount = this.steps.length;

  protected readonly selectedTimeframes = computed((): AnalyzedTimeframe[] => {
    this.formTick();
    this.screenshotDrafts.revisionSnapshot();
    return this.timeframeKeys.filter(
      (tf) => this.contextGroup().get('analyzed_timeframes')?.get(tf)?.value === true,
    );
  });

  protected readonly currentStep = computed(() => this.steps[this.activeStep() - 1]);

  protected readonly selectedDayType = computed((): DayType | null => {
    this.formTick();
    return (this.form.getRawValue() as GatekeeperFormValue).auction_type.day_type;
  });

  protected readonly activePlaybook = computed((): AuctionPlaybook | null => {
    const dayType = this.selectedDayType();
    return dayType ? playbookForDayType(dayType) : null;
  });

  protected readonly locationOptions = computed(() => {
    const playbook = this.activePlaybook();
    return playbook ? getPlaybookLocationOptions(playbook) : [];
  });

  protected readonly behaviorOptions = computed(() => {
    const playbook = this.activePlaybook();
    return playbook ? getPlaybookBehaviorOptions(playbook) : [];
  });

  protected readonly confirmationOptions = computed(() => {
    const playbook = this.activePlaybook();
    return playbook ? getPlaybookConfirmationOptions(playbook) : [];
  });

  protected readonly invalidationHint = computed(() => {
    const playbook = this.activePlaybook();
    return playbook ? invalidationPlaceholder(playbook) : '';
  });

  protected readonly auctionTypeComplete = computed(() => {
    this.formTick();
    return this.isStepValid('auction_type');
  });

  protected readonly pillarSteps = computed((): PillarStepState[] => {
    this.formTick();
    this.screenshotDrafts.revisionSnapshot();
    const value = this.form.getRawValue() as GatekeeperFormValue;
    let contextSummary: string | null = null;
    if (this.isStepValid('context')) {
      try {
        contextSummary = formatHtfContextSummary(mapFormToHtfContext(value));
      } catch {
        contextSummary = null;
      }
    }

    return [
      {
        key: 'context',
        label: 'HTF Context',
        valid: this.isStepValid('context'),
        value: contextSummary,
      },
      {
        key: 'auction_type',
        label: 'Auction Type',
        valid: this.isStepValid('auction_type'),
        value: value.auction_type.day_type ? dayTypeLabel(value.auction_type.day_type) : null,
      },
      {
        key: 'location',
        label: `Location (${pillarFocusLabel(value.location.focus_timeframe)})`,
        valid: this.isStepValid('location'),
        value: value.location.location,
      },
      {
        key: 'behavior',
        label: `Behavior (${pillarFocusLabel(value.behavior.focus_timeframe)})`,
        valid: this.isStepValid('behavior'),
        value: value.behavior.behavior,
      },
      {
        key: 'confirmation',
        label: `Confirmation (${pillarFocusLabel(value.confirmation.focus_timeframe)})`,
        valid: this.isStepValid('confirmation'),
        value: value.confirmation.confirmation,
      },
      {
        key: 'invalidation',
        label: `Invalidation (${pillarFocusLabel(value.invalidation.focus_timeframe)})`,
        valid: this.isStepValid('invalidation'),
        value: value.invalidation.invalidation_level || null,
      },
    ];
  });

  protected readonly pillarsQualified = computed(
    () => this.pillarSteps().every((step) => step.valid) && this.form.controls.is_retest.value,
  );

  protected readonly readinessPct = computed(() =>
    readinessPctFromCompleted(this.pillarSteps().filter((step) => step.valid).length),
  );

  private readonly formTick = signal(0);

  constructor() {
    this.form.valueChanges.subscribe(() => {
      this.formTick.update((n) => n + 1);
      this.ensureActiveTab();
      this.emitState();
      this.scheduleDraftSave();
    });

    this.form.get('is_retest')?.valueChanges.subscribe(() => {
      this.form.get('location.location')?.updateValueAndValidity({ emitEvent: true });
    });

    this.stepGroup('auction_type')
      .get('day_type')
      ?.valueChanges.subscribe((dayType) => {
        if (dayType) {
          this.clearIncompatiblePillarSelections(dayType);
        }
      });

    this.timeframeKeys.forEach((tf) => {
      this.contextGroup()
        .get('analyzed_timeframes')
        ?.get(tf)
        ?.valueChanges.subscribe((enabled) => {
          if (!enabled) {
            this.screenshotDrafts.removeScope({ kind: 'htf', id: tf });
            void this.draftService.clearScopeMedia({ kind: 'htf', id: tf });
          } else {
            this.activeTimeframeTab.set(tf);
          }
        });
    });

    this.emitState();
  }

  protected contextGroup(): FormGroup {
    return this.stepGroup('context');
  }

  protected narrativeGroup(tf: AnalyzedTimeframe): FormGroup {
    return this.journalGroup(tf).get('narrative') as FormGroup;
  }

  protected auctionTypeGroup(): FormGroup {
    return this.stepGroup('auction_type');
  }

  protected journalGroup(tf: AnalyzedTimeframe): FormGroup {
    return (this.contextGroup().get('timeframe_journals') as FormGroup).get(tf) as FormGroup;
  }

  protected stepGroup(key: GatekeeperStepKey): FormGroup {
    return this.form.get(key) as FormGroup;
  }

  protected isStepLocked(stepNumber: number): boolean {
    if (WIZARD_UNLOCK_ALL_STEPS || stepNumber <= 1) {
      return false;
    }

    this.formTick();
    const priorStep = this.steps.find((step) => step.number === stepNumber - 1);
    if (!priorStep) {
      return false;
    }

    return !this.isStepValid(priorStep.key);
  }

  protected isStepValid(key: GatekeeperStepKey): boolean {
    if (key === 'context') {
      const selected = this.selectedTimeframes();
      return (
        this.stepGroup('context').valid &&
        selected.length > 0 &&
        selected.every((tf) => this.journalGroup(tf).valid) &&
        this.screenshotDrafts.hasHtfDraftsFor(selected)
      );
    }

    if (key === 'auction_type') {
      return this.auctionTypeGroup().valid;
    }

    if (!this.isStepValid('auction_type')) {
      return false;
    }

    if (key === 'location') {
      return (
        this.form.controls.is_retest.valid &&
        this.stepGroup('location').valid &&
        this.screenshotDrafts.hasDraft({ kind: 'pillar', id: 'location' })
      );
    }

    if (key === 'behavior') {
      return (
        this.stepGroup('behavior').valid &&
        this.screenshotDrafts.hasDraft({ kind: 'pillar', id: 'behavior' })
      );
    }

    if (key === 'confirmation') {
      return (
        this.stepGroup('confirmation').valid &&
        this.screenshotDrafts.hasDraft({ kind: 'pillar', id: 'confirmation' })
      );
    }

    if (key === 'invalidation') {
      return (
        this.stepGroup('invalidation').valid &&
        this.screenshotDrafts.hasDraft({ kind: 'pillar', id: 'invalidation' })
      );
    }

    return this.stepGroup(key).valid;
  }

  protected timeframeTabLabel(tf: AnalyzedTimeframe): string {
    return timeframeLabel(tf);
  }

  protected isTimeframeComplete(tf: AnalyzedTimeframe): boolean {
    this.screenshotDrafts.revisionSnapshot();
    return this.journalGroup(tf).valid && this.screenshotDrafts.hasDraft({ kind: 'htf', id: tf });
  }

  protected selectedHint(options: { value: string; hint?: string }[], value: string | null): string {
    return options.find((option) => option.value === value)?.hint ?? '';
  }

  protected goToStep(stepNumber: number): void {
    if (this.isStepLocked(stepNumber)) {
      const priorStep = this.steps.find((step) => step.number === stepNumber - 1);
      if (priorStep) {
        this.stepGroup(priorStep.key).markAllAsTouched();
      }
      this.cdr.markForCheck();
      return;
    }
    this.activeStep.set(stepNumber);
    this.scheduleDraftSave();
    this.cdr.markForCheck();
  }

  protected goNext(): void {
    const key = this.currentStep().key;
    this.stepGroup(key).markAllAsTouched();
    if (key === 'context') {
      this.selectedTimeframes().forEach((tf) => {
        this.journalGroup(tf).markAllAsTouched();
      });
    }
    if (key === 'location') {
      this.form.controls.is_retest.markAsTouched();
    }
    if (!this.isStepValid(key)) {
      this.cdr.markForCheck();
      return;
    }
    if (this.activeStep() < this.stepCount) {
      this.activeStep.update((n) => n + 1);
      this.cdr.markForCheck();
    }
  }

  protected goBack(): void {
    if (this.activeStep() > 1) {
      this.activeStep.update((n) => n - 1);
      this.cdr.markForCheck();
    }
  }

  resetWizard(): void {
    this.form.reset();
    this.screenshotDrafts.clearAll();
    this.activeStep.set(1);
    this.activeTimeframeTab.set('W');
    this.emitState();
  }

  async loadFromDraft(result: GatekeeperDraftLoadResult): Promise<void> {
    this.screenshotDrafts.clearAll();
    this.form.patchValue(result.wizardForm, { emitEvent: false });
    syncGatekeeperFormValidators(this.form);
    this.activeStep.set(result.uiState.active_step);
    this.activeTimeframeTab.set(result.uiState.active_timeframe_tab);
    await this.hydrateScreenshots(result.media);
    this.formTick.update((n) => n + 1);
    this.emitState();
    this.cdr.markForCheck();
  }

  private async hydrateScreenshots(media: GatekeeperDraftMedia): Promise<void> {
    for (const [tf, refs] of Object.entries(media.htf)) {
      if (!refs?.length) {
        continue;
      }
      for (const ref of refs) {
        const previewUrl = await this.draftService.createSignedPreviewUrl(ref.storage_path);
        this.screenshotDrafts.addPersistedItem({ kind: 'htf', id: tf as AnalyzedTimeframe }, ref, previewUrl);
      }
    }

    for (const [step, refs] of Object.entries(media.pillars)) {
      if (!refs?.length) {
        continue;
      }
      for (const ref of refs) {
        const previewUrl = await this.draftService.createSignedPreviewUrl(ref.storage_path);
        this.screenshotDrafts.addPersistedItem({ kind: 'pillar', id: step as PillarStepKey }, ref, previewUrl);
      }
    }
  }

  private scheduleDraftSave(): void {
    if (!this.draftService.activeDraftId()) {
      return;
    }

    this.draftService.scheduleSave(this.form.getRawValue() as GatekeeperFormValue, {
      active_step: this.activeStep(),
      active_timeframe_tab: this.activeTimeframeTab(),
    });
  }

  private clearIncompatiblePillarSelections(dayType: DayType): void {
    const playbook = playbookForDayType(dayType);
    const locationValues = new Set(getPlaybookLocationOptions(playbook).map((option) => option.value));
    const behaviorValues = new Set(getPlaybookBehaviorOptions(playbook).map((option) => option.value));
    const confirmationValues = new Set(
      getPlaybookConfirmationOptions(playbook).map((option) => option.value),
    );

    const location = this.stepGroup('location').get('location')?.value;
    if (location && !locationValues.has(location)) {
      this.stepGroup('location').patchValue({ location: null }, { emitEvent: true });
    }

    const behavior = this.stepGroup('behavior').get('behavior')?.value;
    if (behavior && !behaviorValues.has(behavior)) {
      this.stepGroup('behavior').patchValue({ behavior: null }, { emitEvent: true });
    }

    const confirmation = this.stepGroup('confirmation').get('confirmation')?.value;
    if (confirmation && !confirmationValues.has(confirmation)) {
      this.stepGroup('confirmation').patchValue({ confirmation: null }, { emitEvent: true });
    }
  }

  private ensureActiveTab(): void {
    const selected = this.selectedTimeframes();
    if (selected.length === 0) {
      return;
    }
    if (!selected.includes(this.activeTimeframeTab())) {
      this.activeTimeframeTab.set(selected[0]);
    }
  }

  private emitState(): void {
    const qualified = this.pillarsQualified();
    this.pillarsChange.emit({
      pillarSteps: this.pillarSteps(),
      pillarsQualified: qualified,
      isRetest: this.form.controls.is_retest.value,
      formValue: qualified ? (this.form.getRawValue() as GatekeeperFormValue) : null,
    });
  }
}
