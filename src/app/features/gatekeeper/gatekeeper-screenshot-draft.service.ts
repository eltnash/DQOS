import { Injectable, signal } from '@angular/core';

import type { AnalyzedTimeframe, PillarStepKey } from '../../core/models/database.types';

export interface JournalScreenshotItem {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  mimeType: string;
  isAnnotated: boolean;
}

/** @deprecated use JournalScreenshotItem */
export type HtfScreenshotItem = JournalScreenshotItem;

export type JournalScreenshotScope =
  | { kind: 'htf'; id: AnalyzedTimeframe }
  | { kind: 'pillar'; id: PillarStepKey };

function scopeKey(scope: JournalScreenshotScope): string {
  return `${scope.kind}:${scope.id}`;
}

@Injectable({ providedIn: 'root' })
export class GatekeeperScreenshotDraftService {
  private readonly drafts = signal<Record<string, JournalScreenshotItem[]>>({});
  private readonly revision = signal(0);

  readonly revisionSnapshot = this.revision.asReadonly();

  addItem(scope: JournalScreenshotScope, file: File, isAnnotated = false): string {
    const key = scopeKey(scope);
    const id = crypto.randomUUID();
    const item: JournalScreenshotItem = {
      id,
      file,
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
      mimeType: file.type || 'image/png',
      isAnnotated,
    };

    this.drafts.update((current) => ({
      ...current,
      [key]: [...(current[key] ?? []), item],
    }));
    this.revision.update((n) => n + 1);
    return id;
  }

  updateItem(scope: JournalScreenshotScope, itemId: string, file: File, isAnnotated = true): void {
    const key = scopeKey(scope);
    this.drafts.update((current) => {
      const items = current[key] ?? [];
      const nextItems = items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        URL.revokeObjectURL(item.previewUrl);
        return {
          ...item,
          file,
          previewUrl: URL.createObjectURL(file),
          fileName: file.name,
          mimeType: file.type || 'image/png',
          isAnnotated,
        };
      });
      return { ...current, [key]: nextItems };
    });
    this.revision.update((n) => n + 1);
  }

  removeItem(scope: JournalScreenshotScope, itemId: string): void {
    const key = scopeKey(scope);
    this.drafts.update((current) => {
      const items = current[key] ?? [];
      const target = items.find((item) => item.id === itemId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const nextItems = items.filter((item) => item.id !== itemId);
      const next = { ...current };
      if (nextItems.length === 0) {
        delete next[key];
      } else {
        next[key] = nextItems;
      }
      return next;
    });
    this.revision.update((n) => n + 1);
  }

  getItems(scope: JournalScreenshotScope): JournalScreenshotItem[] {
    return this.drafts()[scopeKey(scope)] ?? [];
  }

  getItem(scope: JournalScreenshotScope, itemId: string): JournalScreenshotItem | null {
    return this.getItems(scope).find((item) => item.id === itemId) ?? null;
  }

  removeScope(scope: JournalScreenshotScope): void {
    const key = scopeKey(scope);
    const items = this.drafts()[key] ?? [];
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    this.drafts.update((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    this.revision.update((n) => n + 1);
  }

  hasDraft(scope: JournalScreenshotScope): boolean {
    return (this.drafts()[scopeKey(scope)]?.length ?? 0) > 0;
  }

  hasHtfDraftsFor(timeframes: AnalyzedTimeframe[]): boolean {
    return timeframes.every((tf) => this.hasDraft({ kind: 'htf', id: tf }));
  }

  getHtfDrafts(): Partial<Record<AnalyzedTimeframe, JournalScreenshotItem[]>> {
    const result: Partial<Record<AnalyzedTimeframe, JournalScreenshotItem[]>> = {};
    for (const [key, items] of Object.entries(this.drafts())) {
      if (key.startsWith('htf:')) {
        result[key.slice(4) as AnalyzedTimeframe] = items;
      }
    }
    return result;
  }

  getPillarDrafts(): Partial<Record<PillarStepKey, JournalScreenshotItem[]>> {
    const result: Partial<Record<PillarStepKey, JournalScreenshotItem[]>> = {};
    for (const [key, items] of Object.entries(this.drafts())) {
      if (key.startsWith('pillar:')) {
        result[key.slice(7) as PillarStepKey] = items;
      }
    }
    return result;
  }

  clearAll(): void {
    Object.values(this.drafts()).forEach((items) => {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    });
    this.drafts.set({});
    this.revision.update((n) => n + 1);
  }
}

/** @deprecated use GatekeeperScreenshotDraftService */
export { GatekeeperScreenshotDraftService as HtfScreenshotDraftService };
