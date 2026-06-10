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
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';

import { ASSET_SYMBOL_OPTIONS } from '../../core/supabase/enum-options';
import { GatekeeperDraftService } from '../gatekeeper/gatekeeper-draft.service';
import {
  GATEKEEPER_STEP_LABELS,
  JOURNAL_NAME_MAX_LENGTH,
  type GatekeeperJournalSummary,
} from '../gatekeeper/gatekeeper-draft.types';
import { JournalStepProgressComponent } from './journal-step-progress.component';

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
    TagModule,
    ToastModule,
    JournalStepProgressComponent,
  ],
  templateUrl: './journal-page.component.html',
  styleUrl: './journal-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService, MessageService],
})
export class JournalPageComponent implements OnInit {
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly journals = signal<GatekeeperJournalSummary[]>([]);
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

  protected isArchived(journal: GatekeeperJournalSummary): boolean {
    return journal.archived_at !== null;
  }

  protected isCompleted(journal: GatekeeperJournalSummary): boolean {
    return journal.completed_at !== null;
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
      this.journals.set(list);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load journals');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected startNewJournal(): void {
    this.draftService.clearActive();
    void this.router.navigate(['/gatekeeper']);
  }

  protected resumeJournal(journal: GatekeeperJournalSummary): void {
    void this.router.navigate(['/gatekeeper'], { queryParams: { journalId: journal.id } });
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
      message: `"${journal.journal_name}" and all saved screenshots will be removed. This cannot be undone.`,
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
}
