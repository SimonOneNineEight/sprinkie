import type { Category } from '../api/client';
import { ApiError, createCategory, createEntry, provisionMe, updateEntry } from '../api/client';
import type { ProcessedPhoto } from '../photos/processPhoto';
import { uploadPhotos } from '../photos/uploadPhotos';

import { clearDraft, saveDraft } from './drafts';

// The Entry save pipeline: everything between "the User pressed 儲存 with
// these fields" and "the world is saved, or here is exactly which step
// failed". One interface owns the ordering — Draft keeping on every
// failure (#14), save-time Subcategory creation (#28), create-vs-update
// with the lost-response reconcile (#17), photo upload, Draft clearing —
// so the ordering is testable here, without rendering a screen.
//
// Content is an opaque encoded blob throughout (ADR-0004's discipline,
// extended: the pipeline never parses the diary either).
//
// saveEntry never throws: the api and upload deps are caught into result
// kinds, and the draft-store deps swallow storage failures by contract
// (storage/versionedStore.ts). A deps implementation that rejects on
// saveDraft/clearDraft would break that totality — keep the contract.

export type SaveIntent = {
  accessToken: string;
  /** The Entry date, YYYY-MM-DD (#24); on update the server moves days (#25). */
  date: string;
  categoryId: string;
  /** The Category's color, inherited by a pending Subcategory (#28). */
  categoryColor: string;
  subcategoryId?: string;
  /** Typed-but-unconfirmed Subcategory name, created with the Entry (#28). */
  pendingSubcategoryName?: string;
  /** Opaque encoded blob; the pipeline never looks inside. */
  content: string;
  photos: ProcessedPhoto[];
  /** The Draft slot for failures; doubles as the create's retry key (#17). */
  draftId: string;
  /** When set, the save updates this Entry instead of creating one. */
  existingEntryId?: string;
};

export type SaveResult =
  | { kind: 'saved'; entryId: string; createdSubcategory?: Category }
  | { kind: 'subcategoryFailed' }
  | { kind: 'entryFailed'; createdSubcategory?: Category }
  | { kind: 'photosFailed'; entryId: string; createdSubcategory?: Category };

export type SaveDeps = {
  createEntry: typeof createEntry;
  updateEntry: typeof updateEntry;
  createCategory: typeof createCategory;
  listCategories: (accessToken: string) => Promise<Category[]>;
  saveDraft: typeof saveDraft;
  clearDraft: typeof clearDraft;
  uploadPhotos: typeof uploadPhotos;
};

const productionDeps: SaveDeps = {
  createEntry,
  updateEntry,
  createCategory,
  // No GET /categories exists; /me is idempotent and returns them all. The
  // language is only a seeding hint, and this account is long provisioned.
  listCategories: async (accessToken) => (await provisionMe(accessToken, 'zh-TW')).categories,
  saveDraft,
  clearDraft,
  uploadPhotos,
};

export async function saveEntry(
  intent: SaveIntent,
  deps: SaveDeps = productionDeps,
): Promise<SaveResult> {
  const { accessToken, date, categoryId, content, photos, draftId } = intent;
  let subcategoryId = intent.subcategoryId;
  let pendingLeft = intent.pendingSubcategoryName ?? '';
  let createdSubcategory: Category | undefined;
  let entryId = intent.existingEntryId;

  // Draft retention (#14): any failure keeps the full Entry — words, the
  // staged photos' local copies, and a still-uncreated Subcategory name.
  const keepDraft = () =>
    deps.saveDraft({
      id: draftId,
      date,
      ...(entryId !== undefined ? { entryId } : {}),
      categoryId,
      ...(subcategoryId !== undefined ? { subcategoryId } : {}),
      ...(pendingLeft !== '' ? { pendingSubcategoryName: pendingLeft } : {}),
      content,
      photos,
      savedAt: new Date().toISOString(),
    });

  if (pendingLeft !== '') {
    try {
      createdSubcategory = await deps
        .createCategory(accessToken, {
          name: pendingLeft,
          color: intent.categoryColor,
          parentId: categoryId,
        })
        .catch(async (error: unknown) => {
          // The name is taken (#102): a Draft retried later, or the same
          // Subcategory made elsewhere meanwhile. Refine with that one.
          if (!(error instanceof ApiError && error.status === 409)) throw error;
          const name = pendingLeft.trim().toLowerCase();
          const existing = (await deps.listCategories(accessToken)).find(
            (c) => c.parentId === categoryId && c.name.trim().toLowerCase() === name,
          );
          if (!existing) throw error;
          return existing;
        });
      subcategoryId = createdSubcategory.id;
      pendingLeft = '';
    } catch {
      await keepDraft();
      return { kind: 'subcategoryFailed' };
    }
  }

  const refinement = subcategoryId !== undefined ? { subcategoryId } : {};
  try {
    if (entryId !== undefined) {
      // date rides along on every update; the server only moves the Entry
      // when it actually differs from its current day (#25).
      await deps.updateEntry(accessToken, entryId, { categoryId, ...refinement, content, date });
    } else {
      const created = await deps.createEntry(accessToken, {
        date,
        categoryId,
        ...refinement,
        content,
        // The Draft id doubles as the retry key (#17): it survives the
        // relaunch with the kept Draft, so a create whose response was
        // lost replays onto the original Entry instead of duplicating.
        idempotencyKey: draftId,
      });
      entryId = created.id;
      // A replay hands back the original Entry. If the kept Draft was
      // edited before this retry, the save carries newer values — push
      // them onto the original rather than losing them with the Draft.
      if (
        created.content !== content ||
        created.date !== date ||
        created.categoryId !== categoryId ||
        (created.subcategoryId ?? undefined) !== subcategoryId
      ) {
        await deps.updateEntry(accessToken, entryId, { categoryId, ...refinement, content, date });
      }
    }
  } catch {
    await keepDraft();
    return { kind: 'entryFailed', ...(createdSubcategory ? { createdSubcategory } : {}) };
  }

  try {
    if (photos.length > 0) {
      await deps.uploadPhotos(accessToken, entryId, photos);
    }
  } catch {
    // The Entry's words reached the server; the photos wait in the Draft,
    // pinned to entryId so the retry updates instead of duplicating.
    await keepDraft();
    return { kind: 'photosFailed', entryId, ...(createdSubcategory ? { createdSubcategory } : {}) };
  }

  await deps.clearDraft(draftId);
  return { kind: 'saved', entryId, ...(createdSubcategory ? { createdSubcategory } : {}) };
}
