import { presignPhotos, registerPhotos } from '../api/client';
import type { Photo } from '../api/client';

import type { ProcessedPhoto } from './processPhoto';
import { timed } from './stepTimings';

/** PUT a local file's bytes to a presigned storage URL. */
async function uploadFile(uri: string, uploadUrl: string): Promise<void> {
  const bytes = await (await fetch(uri)).blob();
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    // React Native derives the wire Content-Type from the blob's own type
    // (the explicit header above is overridden), and a blob read from a
    // file URI arrives untyped — storage then rejects the bare media type,
    // so retype it here.
    body: new Blob([bytes], { type: 'image/jpeg' }),
  });
  if (!response.ok) {
    throw new Error(`photo upload responded ${response.status}`);
  }
}

// The direct-to-storage pipeline (#8): presign → upload full and thumb to
// storage (bytes never touch the API) → register the metadata.
export async function uploadPhotos(
  accessToken: string,
  entryId: string,
  staged: ProcessedPhoto[],
): Promise<Photo[]> {
  if (staged.length === 0) return [];
  const { uploads } = await timed('presign', () => presignPhotos(accessToken, entryId, staged.length));
  // Every transfer is issued at once rather than one after another (#44,
  // ratified 2026-09-12): serially the step cost the sum of the uploads,
  // and on a slow uplink a three-photo save sat long enough to read as a
  // crash. Promise.all still waits for the slowest and still rejects on the
  // first failure, so the step stays all-or-nothing to the save pipeline
  // and photosFailed keeps its meaning.
  await Promise.all(
    staged.flatMap((photo, index) => [
      timed(`upload ${index + 1} full`, () => uploadFile(photo.fullUri, uploads[index].uploadUrl)),
      timed(`upload ${index + 1} thumb`, () => uploadFile(photo.thumbUri, uploads[index].thumbUploadUrl)),
    ]),
  );
  const { photos } = await timed('register', () => registerPhotos(
    accessToken,
    entryId,
    staged.map((photo, index) => ({
      objectPath: uploads[index].objectPath,
      thumbPath: uploads[index].thumbPath,
      ...(photo.takenAt ? { takenAt: photo.takenAt } : {}),
    })),
  ));
  return photos;
}
