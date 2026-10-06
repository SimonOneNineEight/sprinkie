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

  // Every resize is specced from a render, never from the asset (#70). The
  // picker reports EXIF-orientation 6/8 photos with width and height transposed
  // against the decoded bitmap, which put the cap on the wrong axis: a 4667px
  // long edge, or an upscale. A render's size is its orientation-corrected
  // bitmap's own.
  const render = async (source: ImageRef | string, size: { width: number; height: number }, edge: number) => {
    const context = ImageManipulator.manipulate(source);
    const spec = resizeSpec(size.width, size.height, edge);
    if (spec) context.resize(spec);
    return context.renderAsync();
  };
  const save = (image: ImageRef) => image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });
  // Runs the ref's last use, then releases it whether or not that use threw.
  const releasing = async <T>(ref: ImageRef, lastUse: (ref: ImageRef) => Promise<T>) => {
    try {
      return await lastUse(ref);
    } finally {
      ref.release();
    }
  };

  // The thumbnail starts from the full render, not from the asset (#53), so the
  // original is decoded once per photo rather than twice. It reads the full's
  // saved file, not its ref (#87): the resize draws through
  // UIGraphicsImageRenderer, which returns a 16-bit extended-range bitmap for a
  // wide-color (Display P3) source, and manipulate() on that ref cannot build
  // its orientation context, so a 48MP iPhone 17 Pro portrait failed to attach.
  // A JPEG always decodes to 8 bits. The thumb is a q0.85 encode of a q0.85
  // encode as a result, which is invisible at 400px.
  //
  // Every ref is released explicitly, and the full's as soon as it is saved.
  // SharedObject.release exists for exactly this ("the native object is known
  // to exclusively retain some native memory (such as binary data or image
  // bitmap)"). A call on a released ref throws, so each is released only after
  // its last use, and on a throw as well (#87): a failed attach can now be
  // retried, and full-size bitmaps should not wait on the GC between tries.
  //
  // Measuring whether this lowers the peak was inconclusive: on a simulator the
  // same build varied by 116 MB between runs, which is wider than the gap
  // between any two versions tested, so treat it as hygiene rather than as a
  // measured win. The peak is owned by EntryFormScreen's Promise.allSettled (#69).
  // The original is decoded once, unresized, so its real size is known before
  // the cap is chosen; the full render resizes that bitmap rather than the file.
  const decoded = await ImageManipulator.manipulate(asset.uri).renderAsync();
  const full = await releasing(decoded, (ref) => render(ref, ref, LONG_EDGE));
  const fullSaved = await releasing(full, save);
  const thumb = await render(fullSaved.uri, fullSaved, THUMB_EDGE);
  const thumbSaved = await releasing(thumb, save);

  return { fullUri: fullSaved.uri, thumbUri: thumbSaved.uri, takenAt };
}
