interface ScreenshotRefLike {
  storage_path?: string;
}

function pathsFromRefs(refs: ScreenshotRefLike[] | undefined): string[] {
  if (!refs?.length) {
    return [];
  }
  return refs.map((ref) => ref.storage_path).filter((path): path is string => Boolean(path));
}

export function collectDraftMediaPaths(media: unknown): string[] {
  if (!media || typeof media !== 'object') {
    return [];
  }

  const record = media as {
    htf?: Record<string, ScreenshotRefLike[]>;
    pillars?: Record<string, ScreenshotRefLike[]>;
  };

  const paths: string[] = [];

  for (const refs of Object.values(record.htf ?? {})) {
    paths.push(...pathsFromRefs(refs));
  }

  for (const refs of Object.values(record.pillars ?? {})) {
    paths.push(...pathsFromRefs(refs));
  }

  return paths;
}

export function collectAuditMediaPaths(htfContext: unknown, pillarJournals: unknown): string[] {
  const paths: string[] = [];

  if (htfContext && typeof htfContext === 'object') {
    const entries = (htfContext as { timeframe_entries?: Array<{ screenshots?: ScreenshotRefLike[] }> })
      .timeframe_entries;
    for (const entry of entries ?? []) {
      paths.push(...pathsFromRefs(entry.screenshots));
    }
  }

  if (pillarJournals && typeof pillarJournals === 'object') {
    for (const journal of Object.values(pillarJournals as Record<string, { screenshots?: ScreenshotRefLike[] }>)) {
      paths.push(...pathsFromRefs(journal?.screenshots));
    }
  }

  return paths;
}
