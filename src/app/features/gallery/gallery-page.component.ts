import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
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
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';

import { AccountScopeService } from '../../core/accounts/account-scope.service';
import { TradingAccountService } from '../../core/accounts/trading-account.service';
import type { AuctionStrategy } from '../../core/models/database.types';
import { AUCTION_STRATEGY_OPTIONS } from '../../core/supabase/enum-options';
import { GatekeeperDraftService } from '../gatekeeper/gatekeeper-draft.service';
import {
  normalizeScreenshotFile,
  readImageFromClipboardEvent,
  readClipboardImageFile,
  validateScreenshotFile,
} from '../gatekeeper/screenshot-upload.utils';
import { GalleryGridComponent } from './components/gallery-grid/gallery-grid.component';
import { GalleryLightboxComponent } from './components/gallery-lightbox/gallery-lightbox.component';
import { GalleryPortfolioPanelComponent } from './components/gallery-portfolio-panel/gallery-portfolio-panel.component';
import { GalleryUploadDialogComponent } from './components/gallery-upload-dialog/gallery-upload-dialog.component';
import { VideoAddDialogComponent } from './components/video-add-dialog/video-add-dialog.component';
import { VideoGridComponent } from './components/video-grid/video-grid.component';
import { VideoPlayerDialogComponent } from './components/video-player-dialog/video-player-dialog.component';
import { PageSkeletonComponent } from '../../shared/components/page-skeleton/page-skeleton.component';
import { GalleryService } from './gallery.service';
import type {
  GalleryMediaMode,
  GalleryVideoComment,
  GalleryVideoItem,
} from './gallery-video.types';
import type {
  GalleryComment,
  GalleryItem,
  GalleryPortfolio,
  GallerySourceFilter,
} from './gallery.types';

@Component({
  selector: 'app-gallery-page',
  imports: [
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    PageSkeletonComponent,
    SelectButtonModule,
    SelectModule,
    TextareaModule,
    ToastModule,
    GalleryGridComponent,
    GalleryLightboxComponent,
    GalleryPortfolioPanelComponent,
    GalleryUploadDialogComponent,
    VideoGridComponent,
    VideoPlayerDialogComponent,
    VideoAddDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './gallery-page.component.html',
  styleUrl: './gallery-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryPageComponent implements OnInit {
  private readonly galleryService = inject(GalleryService);
  private readonly accountScope = inject(AccountScopeService);
  private readonly accountService = inject(TradingAccountService);
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly openingJournal = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly items = signal<GalleryItem[]>([]);
  protected readonly videos = signal<GalleryVideoItem[]>([]);
  protected readonly portfolios = signal<GalleryPortfolio[]>([]);
  protected readonly comments = signal<GalleryComment[]>([]);
  protected readonly videoComments = signal<GalleryVideoComment[]>([]);
  protected readonly currency = signal('USD');

  protected readonly mediaMode = signal<GalleryMediaMode>('images');
  protected readonly mediaModeOptions = [
    { label: 'Images', value: 'images' as GalleryMediaMode },
    { label: 'Videos', value: 'videos' as GalleryMediaMode },
  ];

  protected readonly activeStrategy = signal<AuctionStrategy>('Level_Rejection');
  protected readonly sourceFilter = signal<GallerySourceFilter>('all');
  protected readonly portfolioFilterId = signal<string | null>(null);
  protected readonly searchQuery = signal('');

  protected readonly lightboxOpen = signal(false);
  protected readonly lightboxItem = signal<GalleryItem | null>(null);
  protected readonly videoDialogOpen = signal(false);
  protected readonly videoDialogItem = signal<GalleryVideoItem | null>(null);
  protected readonly videoAddDialogOpen = signal(false);

  protected readonly uploadDialogOpen = signal(false);
  protected readonly pendingFile = signal<File | null>(null);

  protected readonly editDialogOpen = signal(false);
  protected readonly editingItem = signal<GalleryItem | null>(null);
  protected readonly editTitle = signal('');
  protected readonly editCaption = signal('');
  protected readonly editStrategy = signal<AuctionStrategy>('Level_Rejection');
  protected readonly editPortfolioId = signal<string | null>(null);
  protected readonly editRank = signal<number | null>(null);

  protected readonly strategyOptions = AUCTION_STRATEGY_OPTIONS;
  protected readonly sourceFilterOptions = [
    { label: 'All', value: 'all' as GallerySourceFilter },
    { label: 'Uploaded', value: 'upload' as GallerySourceFilter },
    { label: 'From journals', value: 'journal' as GallerySourceFilter },
  ];

  protected readonly filteredItems = computed(() => {
    const strategy = this.activeStrategy();
    const source = this.sourceFilter();
    const portfolioId = this.portfolioFilterId();
    const query = this.searchQuery().trim().toLowerCase();

    return this.items().filter((item) => {
      if (item.auctionStrategy !== strategy) {
        return false;
      }
      if (source !== 'all' && item.source !== source) {
        return false;
      }
      if (portfolioId && item.portfolioId !== portfolioId) {
        return false;
      }
      if (query) {
        const haystack = [
          item.title,
          item.fileName,
          item.journalIdShort,
          item.symbol,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  });

  protected readonly filteredVideos = computed(() => {
    const strategy = this.activeStrategy();
    const source = this.sourceFilter();
    const portfolioId = this.portfolioFilterId();
    const query = this.searchQuery().trim().toLowerCase();

    return this.videos().filter((item) => {
      if (item.auctionStrategy !== strategy) {
        return false;
      }
      if (source !== 'all' && item.source !== source) {
        return false;
      }
      if (portfolioId && item.portfolioId !== portfolioId) {
        return false;
      }
      if (query) {
        const haystack = [item.title, item.journalIdShort, item.symbol, item.sourceUrl]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  });

  protected readonly editPortfolioOptions = computed(() => [
    { label: 'No portfolio', value: null as string | null },
    ...this.portfolios()
      .filter((p) => p.auctionStrategy === this.editStrategy())
      .map((p) => ({ label: p.name, value: p.id })),
  ]);

  ngOnInit(): void {
    void this.reload();
  }

  @HostListener('document:paste', ['$event'])
  protected onPaste(event: ClipboardEvent): void {
    if (this.uploadDialogOpen() || this.editDialogOpen() || this.lightboxOpen()) {
      return;
    }
    const file = readImageFromClipboardEvent(event);
    if (file) {
      event.preventDefault();
      this.queueFile(normalizeScreenshotFile(file, 'gallery-paste'));
    }
  }

  protected async reload(): Promise<void> {
    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const account = await this.accountService.getAccount(accountId);
      if (account) {
        this.currency.set(account.currency);
      }
      const data = await this.galleryService.loadPageData(accountId);
      this.items.set(data.items);
      this.videos.set(data.videos);
      this.portfolios.set(data.portfolios);
      this.comments.set(data.comments);
      this.videoComments.set(data.videoComments);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load gallery');
    } finally {
      this.loading.set(false);
    }
  }

  protected openFilePicker(input: HTMLInputElement): void {
    input.value = '';
    input.click();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.queueFile(normalizeScreenshotFile(file, 'gallery-upload'));
    }
  }

  protected async pasteFromClipboard(): Promise<void> {
    const file = await readClipboardImageFile();
    if (!file) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Clipboard',
        detail: 'No image found in clipboard.',
      });
      return;
    }
    this.queueFile(normalizeScreenshotFile(file, 'gallery-paste'));
  }

  protected queueFile(file: File): void {
    const validationError = validateScreenshotFile(file);
    if (validationError) {
      this.messageService.add({ severity: 'error', summary: 'Upload', detail: validationError });
      return;
    }
    this.pendingFile.set(file);
    this.uploadDialogOpen.set(true);
  }

  protected async confirmUpload(meta: {
    auctionStrategy: AuctionStrategy;
    title: string | null;
    caption: string | null;
    portfolioId: string | null;
    rankScore: number | null;
  }): Promise<void> {
    const accountId = this.accountScope.accountId();
    const file = this.pendingFile();
    if (!accountId || !file) {
      return;
    }

    this.uploading.set(true);
    try {
      await this.galleryService.uploadAsset(accountId, {
        file,
        auctionStrategy: meta.auctionStrategy,
        title: meta.title,
        caption: meta.caption,
        portfolioId: meta.portfolioId,
        rankScore: meta.rankScore,
      });
      this.uploadDialogOpen.set(false);
      this.pendingFile.set(null);
      this.activeStrategy.set(meta.auctionStrategy);
      this.messageService.add({ severity: 'success', summary: 'Uploaded', detail: 'Image added to gallery.' });
      await this.reload();
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Upload failed',
        detail: err instanceof Error ? err.message : 'Could not upload image',
      });
    } finally {
      this.uploading.set(false);
    }
  }

  protected openItem(item: GalleryItem): void {
    this.lightboxItem.set(item);
    this.lightboxOpen.set(true);
  }

  protected async setRank(item: GalleryItem, rank: number): Promise<void> {
    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }

    const newRank = item.rankScore === rank ? null : rank;
    this.saving.set(true);
    try {
      if (item.source === 'upload' && item.galleryAssetId) {
        await this.galleryService.updateAsset(item.galleryAssetId, { rankScore: newRank });
      } else if (item.tradeId != null && item.screenshotIndex != null) {
        await this.galleryService.updateJournalImagePost(accountId, {
          tradeId: item.tradeId,
          screenshotIndex: item.screenshotIndex,
          rankScore: newRank,
          portfolioId: item.portfolioId,
        });
      }
      await this.reload();
      this.syncLightboxItem();
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Rank',
        detail: err instanceof Error ? err.message : 'Could not update rank',
      });
    } finally {
      this.saving.set(false);
    }
  }

  protected async setPortfolio(item: GalleryItem, portfolioId: string | null): Promise<void> {
    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }

    this.saving.set(true);
    try {
      if (item.source === 'upload' && item.galleryAssetId) {
        await this.galleryService.updateAsset(item.galleryAssetId, { portfolioId });
      } else if (item.tradeId != null && item.screenshotIndex != null) {
        await this.galleryService.updateJournalImagePost(accountId, {
          tradeId: item.tradeId,
          screenshotIndex: item.screenshotIndex,
          portfolioId,
          rankScore: item.rankScore,
        });
      }
      await this.reload();
      this.syncLightboxItem();
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Portfolio',
        detail: err instanceof Error ? err.message : 'Could not assign portfolio',
      });
    } finally {
      this.saving.set(false);
    }
  }

  protected async addComment(body: string): Promise<void> {
    const accountId = this.accountScope.accountId();
    const item = this.lightboxItem();
    if (!accountId || !item) {
      return;
    }

    try {
      const target =
        item.galleryAssetId != null
          ? { galleryAssetId: item.galleryAssetId }
          : { tradeId: item.tradeId!, screenshotIndex: item.screenshotIndex! };
      const comment = await this.galleryService.addComment(accountId, body, target);
      this.comments.update((list) => [...list, comment]);
      await this.reload();
      this.syncLightboxItem();
      this.messageService.add({ severity: 'success', summary: 'Comment', detail: 'Comment posted.' });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Comment',
        detail: err instanceof Error ? err.message : 'Could not post comment',
      });
    }
  }

  protected async updateComment(payload: { commentId: string; body: string }): Promise<void> {
    try {
      await this.galleryService.updateComment(payload.commentId, payload.body);
      this.comments.update((list) =>
        list.map((c) => (c.id === payload.commentId ? { ...c, body: payload.body } : c)),
      );
      this.messageService.add({ severity: 'success', summary: 'Comment', detail: 'Comment updated.' });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Comment',
        detail: err instanceof Error ? err.message : 'Could not update comment',
      });
    }
  }

  protected async deleteComment(commentId: string): Promise<void> {
    try {
      await this.galleryService.deleteComment(commentId);
      this.comments.update((list) => list.filter((c) => c.id !== commentId));
      await this.reload();
      this.syncLightboxItem();
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Comment',
        detail: err instanceof Error ? err.message : 'Could not delete comment',
      });
    }
  }

  protected openEdit(item: GalleryItem): void {
    this.editingItem.set(item);
    this.editTitle.set(item.title ?? '');
    this.editCaption.set(item.caption ?? '');
    this.editStrategy.set(item.auctionStrategy);
    this.editPortfolioId.set(item.portfolioId);
    this.editRank.set(item.rankScore);
    this.editDialogOpen.set(true);
  }

  protected async saveEdit(): Promise<void> {
    const item = this.editingItem();
    if (!item?.galleryAssetId) {
      return;
    }

    this.saving.set(true);
    try {
      await this.galleryService.updateAsset(item.galleryAssetId, {
        title: this.editTitle().trim() || null,
        caption: this.editCaption().trim() || null,
        auctionStrategy: this.editStrategy(),
        portfolioId: this.editPortfolioId(),
        rankScore: this.editRank(),
      });
      this.editDialogOpen.set(false);
      this.activeStrategy.set(this.editStrategy());
      await this.reload();
      this.syncLightboxItem();
      this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Image details updated.' });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Save failed',
        detail: err instanceof Error ? err.message : 'Could not save changes',
      });
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDelete(item: GalleryItem): void {
    if (!item.galleryAssetId) {
      return;
    }

    this.confirmationService.confirm({
      message: 'Delete this uploaded image from the gallery?',
      header: 'Confirm delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => void this.deleteItem(item),
    });
  }

  protected async deleteItem(item: GalleryItem): Promise<void> {
    if (!item.galleryAssetId) {
      return;
    }

    try {
      await this.galleryService.deleteAsset(item.galleryAssetId, item.storagePath);
      this.lightboxOpen.set(false);
      this.lightboxItem.set(null);
      await this.reload();
      this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Image removed from gallery.' });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Delete failed',
        detail: err instanceof Error ? err.message : 'Could not delete image',
      });
    }
  }

  protected async openJournal(item: GalleryItem): Promise<void> {
    if (!item.tradeId) {
      return;
    }

    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }

    this.openingJournal.set(true);
    try {
      await this.draftService.ensureJournalForTrade(item.tradeId);
      await this.router.navigate(['/accounts', accountId, 'gatekeeper'], {
        queryParams: { journalId: item.tradeId },
      });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Journal',
        detail: err instanceof Error ? err.message : 'Could not open journal',
      });
    } finally {
      this.openingJournal.set(false);
    }
  }

  protected async createPortfolio(payload: { name: string; description: string | null }): Promise<void> {
    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }

    this.saving.set(true);
    try {
      const portfolio = await this.galleryService.createPortfolio(
        accountId,
        this.activeStrategy(),
        payload.name,
        payload.description,
      );
      this.portfolios.update((list) => [...list, portfolio]);
      this.messageService.add({ severity: 'success', summary: 'Portfolio', detail: 'Portfolio created.' });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Portfolio',
        detail: err instanceof Error ? err.message : 'Could not create portfolio',
      });
    } finally {
      this.saving.set(false);
    }
  }

  protected openVideo(item: GalleryVideoItem): void {
    this.videoDialogItem.set(item);
    this.videoDialogOpen.set(true);
  }

  protected async confirmAddVideo(meta: {
    sourceUrl: string;
    auctionStrategy: AuctionStrategy;
    title: string | null;
    caption: string | null;
    publishedAt: string | null;
    portfolioId: string | null;
    rankScore: number | null;
  }): Promise<void> {
    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }
    this.saving.set(true);
    try {
      await this.galleryService.uploadVideo(accountId, meta);
      this.videoAddDialogOpen.set(false);
      this.mediaMode.set('videos');
      this.activeStrategy.set(meta.auctionStrategy);
      await this.reload();
      this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Video added to gallery.' });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Add failed',
        detail: err instanceof Error ? err.message : 'Could not add video',
      });
    } finally {
      this.saving.set(false);
    }
  }

  protected async setVideoRank(item: GalleryVideoItem, rank: number): Promise<void> {
    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }
    const newRank = item.rankScore === rank ? null : rank;
    this.saving.set(true);
    try {
      if (item.galleryVideoId) {
        await this.galleryService.updateVideo(item.galleryVideoId, { rankScore: newRank });
      } else if (item.tradeId && item.videoEmbedId) {
        await this.galleryService.updateJournalVideoPost(accountId, {
          tradeId: item.tradeId,
          videoEmbedId: item.videoEmbedId,
          rankScore: newRank,
          portfolioId: item.portfolioId,
        });
      }
      await this.reload();
      this.syncVideoDialogItem();
    } finally {
      this.saving.set(false);
    }
  }

  protected async setVideoPortfolio(item: GalleryVideoItem, portfolioId: string | null): Promise<void> {
    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }
    this.saving.set(true);
    try {
      if (item.galleryVideoId) {
        await this.galleryService.updateVideo(item.galleryVideoId, { portfolioId });
      } else if (item.tradeId && item.videoEmbedId) {
        await this.galleryService.updateJournalVideoPost(accountId, {
          tradeId: item.tradeId,
          videoEmbedId: item.videoEmbedId,
          portfolioId,
          rankScore: item.rankScore,
        });
      }
      await this.reload();
      this.syncVideoDialogItem();
    } finally {
      this.saving.set(false);
    }
  }

  protected async addVideoComment(body: string): Promise<void> {
    const accountId = this.accountScope.accountId();
    const item = this.videoDialogItem();
    if (!accountId || !item) {
      return;
    }
    const target =
      item.galleryVideoId != null
        ? { galleryVideoId: item.galleryVideoId }
        : { tradeId: item.tradeId!, videoEmbedId: item.videoEmbedId! };
    const comment = await this.galleryService.addVideoComment(accountId, body, target);
    this.videoComments.update((list) => [...list, comment]);
    await this.reload();
    this.syncVideoDialogItem();
  }

  protected async deleteVideoItem(item: GalleryVideoItem): Promise<void> {
    if (!item.galleryVideoId) {
      return;
    }
    await this.galleryService.deleteVideo(item.galleryVideoId);
    this.videoDialogOpen.set(false);
    await this.reload();
  }

  protected async openJournalForVideo(item: GalleryVideoItem): Promise<void> {
    if (!item.tradeId) {
      return;
    }
    const accountId = this.accountScope.accountId();
    if (!accountId) {
      return;
    }
    this.openingJournal.set(true);
    try {
      await this.draftService.ensureJournalForTrade(item.tradeId);
      await this.router.navigate(['/accounts', accountId, 'gatekeeper'], {
        queryParams: { journalId: item.tradeId },
      });
    } finally {
      this.openingJournal.set(false);
    }
  }

  private syncLightboxItem(): void {
    const current = this.lightboxItem();
    if (!current) {
      return;
    }
    const updated = this.items().find((i) => i.id === current.id) ?? null;
    this.lightboxItem.set(updated);
    if (!updated) {
      this.lightboxOpen.set(false);
    }
  }

  private syncVideoDialogItem(): void {
    const current = this.videoDialogItem();
    if (!current) {
      return;
    }
    const updated = this.videos().find((i) => i.id === current.id) ?? null;
    this.videoDialogItem.set(updated);
    if (!updated) {
      this.videoDialogOpen.set(false);
    }
  }
}
