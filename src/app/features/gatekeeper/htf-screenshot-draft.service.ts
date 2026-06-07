import { Injectable, signal } from '@angular/core';

import type { AnalyzedTimeframe } from '../../core/models/database.types';

export interface HtfScreenshotDraft {
  file: File;
  previewUrl: string;
  fileName: string;
  mimeType: string;
  isAnnotated: boolean;
}

@Injectable({ providedIn: 'root' })
export class HtfScreenshotDraftService {
  private readonly drafts = signal<Partial<Record<AnalyzedTimeframe, HtfScreenshotDraft>>>({});
  private readonly revision = signal(0);

  readonly revisionSnapshot = this.revision.asReadonly();

  setDraft(timeframe: AnalyzedTimeframe, file: File, isAnnotated = false): void {
    const existing = this.drafts()[timeframe];
    if (existing) {
      URL.revokeObjectURL(existing.previewUrl);
    }

    this.drafts.update((current) => ({
      ...current,
      [timeframe]: {
        file,
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
        mimeType: file.type || 'image/png',
        isAnnotated,
      },
    }));
    this.revision.update((n) => n + 1);
  }

  removeDraft(timeframe: AnalyzedTimeframe): void {
    const existing = this.drafts()[timeframe];
    if (existing) {
      URL.revokeObjectURL(existing.previewUrl);
    }

    this.drafts.update((current) => {
      const next = { ...current };
      delete next[timeframe];
      return next;
    });
    this.revision.update((n) => n + 1);
  }

  getDraft(timeframe: AnalyzedTimeframe): HtfScreenshotDraft | null {
    return this.drafts()[timeframe] ?? null;
  }

  hasDraft(timeframe: AnalyzedTimeframe): boolean {
    return this.drafts()[timeframe] != null;
  }

  hasDraftsFor(timeframes: AnalyzedTimeframe[]): boolean {
    return timeframes.every((tf) => this.hasDraft(tf));
  }

  getAllDrafts(): Partial<Record<AnalyzedTimeframe, HtfScreenshotDraft>> {
    return this.drafts();
  }

  clearAll(): void {
    Object.values(this.drafts()).forEach((draft) => {
      if (draft) {
        URL.revokeObjectURL(draft.previewUrl);
      }
    });
    this.drafts.set({});
    this.revision.update((n) => n + 1);
  }
}
