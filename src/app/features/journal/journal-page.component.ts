import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';

import { ASSET_SYMBOL_OPTIONS } from '../../core/supabase/enum-options';
import { formatJournalIdShort } from '../../shared/utils/journal-id.utils';
import {
  auctionStrategyLabel,
  auctionStrategyTagSeverity,
} from '../gatekeeper/auction-playbook.utils';
import { AccountRiskService } from '../../core/accounts/account-risk.service';
import { formatRiskBlockMessage } from '../../core/accounts/account-risk.utils';
import { AccountScopeService } from '../../core/accounts/account-scope.service';
import { AccountRiskBannerComponent } from '../../shared/components/account-risk-banner/account-risk-banner.component';
import { GatekeeperDraftService } from '../gatekeeper/gatekeeper-draft.service';
import type { AuctionStrategy } from '../../core/models/database.types';
import {
  GATEKEEPER_STEP_LABELS,
  JOURNAL_NAME_MAX_LENGTH,
  type GatekeeperJournalSummary,
} from '../gatekeeper/gatekeeper-draft.types';
import { JournalStepProgressComponent } from './journal-step-progress.component';
import { sortJournals } from './journal-page.utils';
import {
  JOURNAL_SORT_DIR_STORAGE_KEY,
  JOURNAL_SORT_FIELD_STORAGE_KEY,
  JOURNAL_VIEW_STORAGE_KEY,
  type JournalSortDirection,
  type JournalSortField,
  type JournalViewMode,
} from './journal-page.types';

@Component({
  selector: 'app-journal-page',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    SelectButtonModule,
    SelectModule,
    TagModule,
    ToastModule,
    JournalStepProgressComponent,
    AccountRiskBannerComponent,
  ],
  templateUrl: './journal-page.component.html',
  styleUrl: './journal-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService, MessageService],
})
export class JournalPageComponent implements OnInit {
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly accountScope = inject(AccountScopeService);
  private readonly riskService = inject(AccountRiskService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly accountId = this.accountScope.accountId;
  protected readonly recordingBlocked = computed(() => this.riskService.status().blocked);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly rawJournals = signal<GatekeeperJournalSummary[]>([]);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly showArchived = signal(false);
  protected readonly actionBusyId = signal<string | null>(null);
  protected readonly renameDialogVisible = signal(false);
  protected readonly renameTarget = signal<GatekeeperJournalSummary | null>(null);
  protected renameValue = '';
  protected readonly renameSaving = signal(false);
  protected readonly stepLabels = GATEKEEPER_STEP_LABELS;
  protected readonly journalNameMaxLength = JOURNAL_NAME_MAX_LENGTH;

  protected readonly viewMode = signal<JournalViewMode>(
    this.readStoredViewMode(),
  );
  protected readonly sortField = signal<JournalSortField>(
    this.readStoredSortField(),
  );
  protected readonly sortDirection = signal<JournalSortDirection>(
    this.readStoredSortDirection(),
  );

  protected readonly viewModeOptions = [
    { label: 'Cards', value: 'cards' as const, icon: 'pi pi-th-large' },
    { label: 'List', value: 'list' as const, icon: 'pi pi-list' },
  ];

  protected readonly sortFieldOptions = [
    { label: 'Date created', value: 'created_at' as const },
    { label: 'Last updated', value: 'updated_at' as const },
    { label: 'Trading date', value: 'trading_date' as const },
    { label: 'Journal name', value: 'journal_name' as const },
    { label: 'Progress', value: 'progress' as const },
  ];

  protected readonly journals = computed(() =>
    sortJournals(this.rawJournals(), this.sortField(), this.sortDirection()),
  );

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

  protected readonly formatJournalId = formatJournalIdShort;

  protected symbolLabel(symbol: string): string {
    return this.symbolLabels().get(symbol) ?? symbol;
  }

  protected stepLabel(stepNumber: number): string {
    return this.stepLabels[Math.max(0, Math.min(stepNumber - 1, this.stepLabels.length - 1))];
  }

  protected strategyLabel(strategy: AuctionStrategy | null): string {
    return strategy ? auctionStrategyLabel(strategy) : '';
  }

  protected strategyTagSeverity(strategy: AuctionStrategy): 'info' | 'success' {
    return auctionStrategyTagSeverity(strategy);
  }

  protected isArchived(journal: GatekeeperJournalSummary): boolean {
    return journal.archived_at !== null;
  }

  protected isCompleted(journal: GatekeeperJournalSummary): boolean {
    return journal.completed_at !== null;
  }

  protected sortDirectionLabel(): string {
    return this.sortDirection() === 'asc' ? 'Ascending' : 'Descending';
  }

  protected toggleSortDirection(): void {
    const next = this.sortDirection() === 'asc' ? 'desc' : 'asc';
    this.sortDirection.set(next);
    this.persistPreferences();
  }

  protected onViewModeChange(mode: JournalViewMode): void {
    this.viewMode.set(mode);
    this.persistPreferences();
  }

  protected onSortFieldChange(field: JournalSortField): void {
    this.sortField.set(field);
    this.persistPreferences();
  }

  protected toggleShowArchived(): void {
    this.showArchived.update((value) => !value);
    void this.loadJournals();
  }

  protected async loadJournals(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const list = await this.draftService.listJournals({ archivedOnly: this.showArchived() });
      this.rawJournals.set(list);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load journals');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected startNewJournal(): void {
    if (this.recordingBlocked()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Recording paused',
        detail: formatRiskBlockMessage(this.riskService.status()),
        life: 8000,
      });
      return;
    }

    this.draftService.clearActive();
    this.navigateToGatekeeper();
  }

  protected resumeJournal(journal: GatekeeperJournalSummary): void {
    this.navigateToGatekeeper({ journalId: journal.id });
  }

  private navigateToGatekeeper(queryParams?: Record<string, string>): void {
    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }
    void this.router.navigate(['/accounts', accountId, 'gatekeeper'], { queryParams });
  }

  protected openRenameDialog(journal: GatekeeperJournalSummary): void {
    this.renameTarget.set(journal);
    this.renameValue = journal.journal_name;
    this.renameDialogVisible.set(true);
  }

  protected closeRenameDialog(): void {
    if (this.renameSaving()) {
      return;
    }
    this.renameDialogVisible.set(false);
    this.renameTarget.set(null);
    this.renameValue = '';
  }

  protected async confirmRename(): Promise<void> {
    const journal = this.renameTarget();
    if (!journal) {
      return;
    }

    this.renameSaving.set(true);
    this.cdr.markForCheck();

    try {
      const updatedName = await this.draftService.renameJournal(journal.id, this.renameValue);
      this.messageService.add({
        severity: 'success',
        summary: 'Journal renamed',
        detail: `Renamed to "${updatedName}".`,
        life: 3500,
      });
      this.closeRenameDialog();
      await this.loadJournals();
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Rename failed',
        detail: err instanceof Error ? err.message : 'Could not rename journal',
        life: 6000,
      });
    } finally {
      this.renameSaving.set(false);
      this.cdr.markForCheck();
    }
  }

  protected confirmArchive(journal: GatekeeperJournalSummary): void {
    this.confirmationService.confirm({
      header: 'Archive journal?',
      message: `"${journal.journal_name}" will be hidden from your main list. You can restore it later from archived journals.`,
      icon: 'pi pi-inbox',
      acceptLabel: 'Archive',
      rejectLabel: 'Cancel',
      accept: () => void this.runJournalAction(journal.id, 'archive'),
    });
  }

  protected confirmRestore(journal: GatekeeperJournalSummary): void {
    void this.runJournalAction(journal.id, 'restore');
  }

  protected confirmDelete(journal: GatekeeperJournalSummary): void {
    this.confirmationService.confirm({
      header: 'Delete journal permanently?',
      message: `"${journal.journal_name}", its linked trade in Trade History, screenshots, and audit data will be permanently removed. This cannot be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => void this.runJournalAction(journal.id, 'delete'),
    });
  }

  private async runJournalAction(
    journalId: string,
    action: 'archive' | 'restore' | 'delete',
  ): Promise<void> {
    this.actionBusyId.set(journalId);
    this.cdr.markForCheck();

    try {
      if (action === 'archive') {
        await this.draftService.archiveJournal(journalId);
        this.messageService.add({
          severity: 'success',
          summary: 'Journal archived',
          detail: 'You can restore it from archived journals.',
          life: 3500,
        });
      } else if (action === 'restore') {
        await this.draftService.restoreJournal(journalId);
        this.messageService.add({
          severity: 'success',
          summary: 'Journal restored',
          detail: 'It appears in your active journal list again.',
          life: 3500,
        });
      } else {
        await this.draftService.deleteJournal(journalId);
        this.messageService.add({
          severity: 'success',
          summary: 'Journal deleted',
          detail: 'The journal and its screenshots were removed.',
          life: 3500,
        });
      }

      await this.loadJournals();
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Action failed',
        detail: err instanceof Error ? err.message : 'Could not update journal',
        life: 6000,
      });
    } finally {
      this.actionBusyId.set(null);
      this.cdr.markForCheck();
    }
  }

  private readStoredViewMode(): JournalViewMode {
    const value = localStorage.getItem(JOURNAL_VIEW_STORAGE_KEY);
    return value === 'list' ? 'list' : 'cards';
  }

  private readStoredSortField(): JournalSortField {
    const value = localStorage.getItem(JOURNAL_SORT_FIELD_STORAGE_KEY);
    if (
      value === 'created_at' ||
      value === 'updated_at' ||
      value === 'trading_date' ||
      value === 'journal_name' ||
      value === 'progress'
    ) {
      return value;
    }
    return 'created_at';
  }

  private readStoredSortDirection(): JournalSortDirection {
    return localStorage.getItem(JOURNAL_SORT_DIR_STORAGE_KEY) === 'asc' ? 'asc' : 'desc';
  }

  private persistPreferences(): void {
    localStorage.setItem(JOURNAL_VIEW_STORAGE_KEY, this.viewMode());
    localStorage.setItem(JOURNAL_SORT_FIELD_STORAGE_KEY, this.sortField());
    localStorage.setItem(JOURNAL_SORT_DIR_STORAGE_KEY, this.sortDirection());
  }
}
