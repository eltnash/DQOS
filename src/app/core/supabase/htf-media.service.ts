import { Injectable, inject } from '@angular/core';

import type { AnalyzedTimeframe, HtfContextSnapshot } from '../models/database.types';
import { SupabaseService } from './supabase.service';

const BUCKET = 'trade-screenshots';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Injectable({ providedIn: 'root' })
export class HtfMediaService {
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

  buildStoragePath(
    userId: string,
    tradeId: string,
    timeframe: AnalyzedTimeframe,
    fileName: string,
  ): string {
    const ext = fileName.includes('.') ? fileName.split('.').pop() : 'png';
    return `${userId}/${tradeId}/htf/${timeframe}/${crypto.randomUUID()}.${ext}`;
  }

  async attachScreenshotsToContext(
    tradeId: string,
    context: HtfContextSnapshot,
    drafts: Partial<
      Record<
        AnalyzedTimeframe,
        { file: File; fileName: string; mimeType: string; isAnnotated: boolean }
      >
    >,
  ): Promise<HtfContextSnapshot> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const uploadedPaths: string[] = [];
    const entries = await Promise.all(
      context.timeframe_entries.map(async (entry) => {
        const draft = drafts[entry.timeframe];
        if (!draft) {
          throw new Error(`Missing screenshot for ${entry.timeframe}`);
        }

        const validationError = this.validateFile(draft.file);
        if (validationError) {
          throw new Error(`${entry.timeframe}: ${validationError}`);
        }

        const storagePath = this.buildStoragePath(user.id, tradeId, entry.timeframe, draft.fileName);
        const { error } = await this.supabase.client.storage
          .from(BUCKET)
          .upload(storagePath, draft.file, {
            contentType: draft.mimeType || 'image/png',
            upsert: false,
          });

        if (error) {
          throw new Error(error.message);
        }

        uploadedPaths.push(storagePath);

        return {
          ...entry,
          screenshot: {
            storage_path: storagePath,
            file_name: draft.fileName,
            mime_type: draft.mimeType || 'image/png',
            is_annotated: draft.isAnnotated,
          },
        };
      }),
    );

    return { ...context, timeframe_entries: entries };
  }

  async rollbackUploads(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    await this.supabase.client.storage.from(BUCKET).remove(paths);
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
}
