import { Injectable, inject } from '@angular/core';

import type {
  AnalyzedTimeframe,
  HtfContextSnapshot,
  PillarJournalsSnapshot,
  PillarStepKey,
} from '../models/database.types';
import { SupabaseService } from './supabase.service';

const BUCKET = 'trade-screenshots';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface ScreenshotUploadDraft {
  file: File;
  fileName: string;
  mimeType: string;
  isAnnotated: boolean;
}

@Injectable({ providedIn: 'root' })
export class GatekeeperMediaService {
  private readonly supabase = inject(SupabaseService);

  validateFile(file: File): string | null {
    if (!ALLOWED_MIME.has(file.type) && file.type !== '') {
      return 'Use PNG, JPEG, or WebP images only.';
    }
    if (file.size > MAX_BYTES) {
      return 'Image must be 5 MB or smaller.';
    }
    return null;
  }

  buildHtfStoragePath(
    userId: string,
    tradeId: string,
    timeframe: AnalyzedTimeframe,
    fileName: string,
  ): string {
    const ext = fileName.includes('.') ? fileName.split('.').pop() : 'png';
    return `${userId}/${tradeId}/htf/${timeframe}/${crypto.randomUUID()}.${ext}`;
  }

  buildPillarStoragePath(
    userId: string,
    tradeId: string,
    step: PillarStepKey,
    fileName: string,
  ): string {
    const ext = fileName.includes('.') ? fileName.split('.').pop() : 'png';
    return `${userId}/${tradeId}/pillars/${step}/${crypto.randomUUID()}.${ext}`;
  }

  async attachHtfScreenshots(
    tradeId: string,
    context: HtfContextSnapshot,
    drafts: Partial<Record<AnalyzedTimeframe, ScreenshotUploadDraft[]>>,
  ): Promise<HtfContextSnapshot> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const entries = await Promise.all(
      context.timeframe_entries.map(async (entry) => {
        const draftItems = drafts[entry.timeframe];
        if (!draftItems?.length) {
          throw new Error(`Missing screenshot for ${entry.timeframe}`);
        }

        const screenshots = await this.uploadDrafts(
          draftItems,
          (fileName) => this.buildHtfStoragePath(user.id, tradeId, entry.timeframe, fileName),
          entry.timeframe,
        );

        return { ...entry, screenshots };
      }),
    );

    return { ...context, timeframe_entries: entries };
  }

  async attachPillarScreenshots(
    tradeId: string,
    journals: PillarJournalsSnapshot,
    drafts: Partial<Record<PillarStepKey, ScreenshotUploadDraft[]>>,
  ): Promise<PillarJournalsSnapshot> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const steps: PillarStepKey[] = ['location', 'behavior', 'confirmation', 'invalidation'];
    const result = { ...journals } as PillarJournalsSnapshot;

    for (const step of steps) {
      const draftItems = drafts[step];
      if (!draftItems?.length) {
        throw new Error(`Missing screenshot for ${step} pillar`);
      }

      result[step] = {
        ...journals[step],
        screenshots: await this.uploadDrafts(
          draftItems,
          (fileName) => this.buildPillarStoragePath(user.id, tradeId, step, fileName),
          step,
        ),
      };
    }

    return result;
  }

  async updateAuditHtfContext(auditId: string, context: HtfContextSnapshot): Promise<void> {
    const { error } = await this.supabase.client
      .from('execution_audits')
      .update({ htf_context: context })
      .eq('id', auditId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async updateAuditPillarJournals(auditId: string, journals: PillarJournalsSnapshot): Promise<void> {
    const { error } = await this.supabase.client
      .from('execution_audits')
      .update({ pillar_journals: journals })
      .eq('id', auditId);

    if (error) {
      throw new Error(error.message);
    }
  }

  private async uploadDrafts(
    draftItems: ScreenshotUploadDraft[],
    buildPath: (fileName: string) => string,
    label: string,
  ) {
    return Promise.all(
      draftItems.map(async (draft) => {
        const validationError = this.validateFile(draft.file);
        if (validationError) {
          throw new Error(`${label}: ${validationError}`);
        }

        const storagePath = buildPath(draft.fileName);
        const { error } = await this.supabase.client.storage
          .from(BUCKET)
          .upload(storagePath, draft.file, {
            contentType: draft.mimeType || 'image/png',
            upsert: false,
          });

        if (error) {
          throw new Error(error.message);
        }

        return {
          storage_path: storagePath,
          file_name: draft.fileName,
          mime_type: draft.mimeType || 'image/png',
          is_annotated: draft.isAnnotated,
        };
      }),
    );
  }
}

/** @deprecated use GatekeeperMediaService */
export { GatekeeperMediaService as HtfMediaService };
