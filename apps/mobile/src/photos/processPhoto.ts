import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

// Client-side photo processing (#8): re-encode to a print-safe ~3500px long
// edge at quality 0.85 and generate a calendar thumbnail. The manipulator
// writes fresh JPEGs with no EXIF, so GPS is stripped by construction; the
// capture time is read from the picker asset BEFORE processing and travels
// as structured metadata instead.
const LONG_EDGE = 3500;
const THUMB_EDGE = 400;
const QUALITY = 0.85;

export type ProcessedPhoto = {
  fullUri: string;
  thumbUri: string;
  takenAt?: string;
};

/** EXIF DateTimeOriginal ("2026:08:19 15:04:05", local) → RFC3339 UTC. */
export function takenAtFromExif(exif: Record<string, unknown> | undefined | null): string | undefined {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime;
  if (typeof raw !== 'string') return undefined;
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match;
  const local = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (Number.isNaN(local.getTime())) return undefined;
  return local.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Longest-edge cap that never upscales. */
export function resizeSpec(width: number, height: number, edge: number): { width: number } | { height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= edge) return null;
  return width >= height ? { width: edge } : { height: edge };
}

export async function processPhoto(asset: ImagePickerAsset): Promise<ProcessedPhoto> {
  const takenAt = takenAtFromExif(asset.exif as Record<string, unknown> | undefined);

  const render = async (source: ImagePickerAsset | ImageRef, edge: number) => {
    const context = ImageManipulator.manipulate('uri' in source ? source.uri : source);
    const spec = resizeSpec(source.width, source.height, edge);
    if (spec) context.resize(spec);
    return context.renderAsync();
  };
  const save = (image: ImageRef) => image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });

  // The thumbnail starts from the full render, not from the asset (#53), so the
  // original is decoded once per photo rather than twice. EntryFormScreen
  // processes up to three at a time and the picker can hand back an 8K frame, so
  // the second decode was the memory spike. It is the rendered image that is
  // passed on, not its saved file, which keeps the thumb a single encode of the
  // same pixels and keeps the original out of reach: reading it again for any
  // reason would put the EXIF this pipeline strips back into storage.
  const full = await render(asset, LONG_EDGE);
  const fullSaved = await save(full);
  const thumb = await render(full, THUMB_EDGE);
  const thumbSaved = await save(thumb);

  return { fullUri: fullSaved.uri, thumbUri: thumbSaved.uri, takenAt };
}
