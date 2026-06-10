const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

function inferImageMimeType(file: File): string | null {
  if (file.type.startsWith('image/')) {
    return file.type;
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return null;
  }

  if (ext === 'jpg' || ext === 'jpeg') {
    return 'image/jpeg';
  }
  if (ext === 'webp') {
    return 'image/webp';
  }
  return 'image/png';
}

export function normalizeScreenshotFile(file: File, prefix: string): File {
  const inferredType = inferImageMimeType(file);
  const type = inferredType ?? file.type ?? 'image/png';
  const name =
    file.name && file.name.trim().length > 0
      ? file.name
      : `${prefix}-${Date.now()}.${type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png'}`;

  if (file.name === name && file.type === type) {
    return file;
  }

  return new File([file], name, { type });
}

export function validateScreenshotFile(file: File): string | null {
  if (file.size === 0) {
    return 'Image file is empty.';
  }

  if (file.size > MAX_BYTES) {
    return 'Image must be 5 MB or smaller.';
  }

  const mime = inferImageMimeType(file);
  if (!mime) {
    return 'Please use PNG, JPEG, or WebP images only.';
  }

  return null;
}

export function readImageFromClipboardEvent(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) {
    return null;
  }

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }

  return null;
}

/** Reads image from system clipboard (requires user gesture — call from a click handler). */
export async function readClipboardImageFile(): Promise<File | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.read) {
    return null;
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'));
      if (!imageType) {
        continue;
      }

      const blob = await item.getType(imageType);
      if (blob) {
        return new File([blob], `clipboard-${Date.now()}.png`, { type: imageType });
      }
    }
  } catch {
    return null;
  }

  return null;
}
