import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

import { ASSET_SYMBOL_OPTIONS } from '../../core/supabase/enum-options';
import { GatekeeperDraftService } from '../gatekeeper/gatekeeper-draft.service';
import {
  GATEKEEPER_STEP_LABELS,
  type GatekeeperJournalSummary,
} from '../gatekeeper/gatekeeper-draft.types';

@Component({
  selector: 'app-journal-page',
  imports: [DatePipe, ButtonModule, MessageModule, ProgressSpinnerModule, TagModule],
  templateUrl: './journal-page.component.html',
  styleUrl: './journal-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalPageComponent implements OnInit {
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly router = inject(Router);

  protected readonly journals = signal<GatekeeperJournalSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stepLabels = GATEKEEPER_STEP_LABELS;

  private readonly symbolLabels = computed(() => {
    const map = new Map<string, string>();
    for (const option of ASSET_SYMBOL_OPTIONS) {
      map.set(option.value, option.label);
    }
    return map;
  });

  ngOnInit(): void {
    void this.loadJournals();
  }

  protected symbolLabel(symbol: string): string {
    return this.symbolLabels().get(symbol) ?? symbol;
  }

  protected stepLabel(stepNumber: number): string {
    return this.stepLabels[Math.max(0, Math.min(stepNumber - 1, this.stepLabels.length - 1))];
  }

  protected async loadJournals(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const list = await this.draftService.listJournals();
      this.journals.set(list);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load journals');
    } finally {
      this.loading.set(false);
    }
  }

  protected startNewJournal(): void {
    this.draftService.clearActive();
    void this.router.navigate(['/gatekeeper']);
  }

  protected resumeJournal(journal: GatekeeperJournalSummary): void {
    void this.router.navigate(['/gatekeeper'], { queryParams: { journalId: journal.id } });
  }
}
