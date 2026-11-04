import type { Category } from '../api/client';
import { ApiError } from '../api/client';
import type { ProcessedPhoto } from '../photos/processPhoto';
import { saveEntry, type SaveDeps, type SaveIntent } from './save';

// The save pipeline's whole matrix, exercised at its interface with fake
// deps — no rendering, no fetch. The screen suites keep only wiring and
// cross-screen draft behavior.

const photo: ProcessedPhoto = {
  fullUri: 'file://p1.jpg',
  thumbUri: 'file://p1_t.jpg',
  width: 100,
  height: 100,
} as ProcessedPhoto;

function intent(overrides: Partial<SaveIntent> = {}): SaveIntent {
  return {
    accessToken: 'tok',
    date: '2026-08-19',
    categoryId: 'c-sport',
    categoryColor: '#73B062',
    content: 'v1|{"blob"}',
    photos: [],
    draftId: 'd-test-1',
    ...overrides,
  };
}

function fakeDeps(overrides: Partial<SaveDeps> = {}): SaveDeps {
  return {
    createEntry: jest.fn(async (_token, body) => ({
      id: 'e-1',
      date: body.date,
      position: 1,
      categoryId: body.categoryId,
      ...(body.subcategoryId !== undefined ? { subcategoryId: body.subcategoryId } : {}),
      authorId: 'u1',
      content: body.content,
    })),
    updateEntry: jest.fn(async (_token, id, body) => ({
      id,
      date: body.date ?? '2026-08-19',
      position: 1,
      categoryId: body.categoryId,
      authorId: 'u1',
      content: body.content,
    })),
    createCategory: jest.fn(
      async (_token, body) =>
        ({
          id: 'sub-1',
          name: body.name,
          color: body.color,
          parentId: body.parentId,
          icon: 'tag',
          position: 9,
        }) as Category,
    ),
    listCategories: jest.fn(async () => []),
    saveDraft: jest.fn(async () => {}),
    clearDraft: jest.fn(async () => {}),
    uploadPhotos: jest.fn(async () => []),
    ...overrides,
  };
}

describe('create', () => {
  it('creates with the draft id as the retry key and clears the Draft', async () => {
    const deps = fakeDeps();
    const result = await saveEntry(intent(), deps);

    expect(result).toEqual({ kind: 'saved', entryId: 'e-1' });
    expect(deps.createEntry).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ date: '2026-08-19', categoryId: 'c-sport', idempotencyKey: 'd-test-1' }),
    );
    expect(deps.updateEntry).not.toHaveBeenCalled();
    expect(deps.clearDraft).toHaveBeenCalledWith('d-test-1');
    expect(deps.saveDraft).not.toHaveBeenCalled();
  });

  it('a failed create keeps the Draft and reports entryFailed', async () => {
    const deps = fakeDeps({ createEntry: jest.fn(async () => Promise.reject(new Error('net'))) });
    const result = await saveEntry(intent({ photos: [photo] }), deps);

    expect(result).toEqual({ kind: 'entryFailed' });
    expect(deps.clearDraft).not.toHaveBeenCalled();
    expect(deps.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'd-test-1',
        date: '2026-08-19',
        categoryId: 'c-sport',
        content: 'v1|{"blob"}',
        photos: [photo],
      }),
    );
    const kept = (deps.saveDraft as jest.Mock).mock.calls[0][0];
    expect(kept.entryId).toBeUndefined();
  });
});

describe('update', () => {
  it('an existing Entry updates in place, date riding along', async () => {
    const deps = fakeDeps();
    const result = await saveEntry(intent({ existingEntryId: 'e-9' }), deps);

    expect(result).toEqual({ kind: 'saved', entryId: 'e-9' });
    expect(deps.createEntry).not.toHaveBeenCalled();
    expect(deps.updateEntry).toHaveBeenCalledWith(
      'tok',
      'e-9',
      expect.objectContaining({ categoryId: 'c-sport', content: 'v1|{"blob"}', date: '2026-08-19' }),
    );
  });

  it('a failed update keeps the Draft pinned to its Entry', async () => {
    const deps = fakeDeps({ updateEntry: jest.fn(async () => Promise.reject(new Error('net'))) });
    const result = await saveEntry(intent({ existingEntryId: 'e-9' }), deps);

    expect(result).toEqual({ kind: 'entryFailed' });
    expect(deps.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'e-9' }));
  });
});

describe('pending Subcategory (#28)', () => {
  it('creates it under the Category with its color, then saves refined', async () => {
    const deps = fakeDeps();
    const result = await saveEntry(intent({ pendingSubcategoryName: '夜跑' }), deps);

    expect(deps.createCategory).toHaveBeenCalledWith('tok', {
      name: '夜跑',
      color: '#73B062',
      parentId: 'c-sport',
    });
    expect(deps.createEntry).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ subcategoryId: 'sub-1' }),
    );
    expect(result.kind).toBe('saved');
    expect('createdSubcategory' in result && result.createdSubcategory?.id).toBe('sub-1');
  });

  it('its failure stops before the Entry write and keeps the name in the Draft', async () => {
    const deps = fakeDeps({ createCategory: jest.fn(async () => Promise.reject(new Error('net'))) });
    const result = await saveEntry(intent({ pendingSubcategoryName: '夜跑' }), deps);

    expect(result).toEqual({ kind: 'subcategoryFailed' });
    expect(deps.createEntry).not.toHaveBeenCalled();
    expect(deps.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ pendingSubcategoryName: '夜跑' }),
    );
  });

  it('uses the existing Subcategory when the name turns out to be taken (#102)', async () => {
    // A Draft retried later, or the same name made elsewhere meanwhile: the
    // create answers 409, and the save refines with the one that exists.
    const existing = {
      id: 'sub-existing',
      name: '夜跑',
      color: '#73B062',
      parentId: 'c-sport',
      icon: 'tag',
      position: 2,
    } as Category;
    const deps = fakeDeps({
      createCategory: jest.fn(async () => Promise.reject(new ApiError('/categories', 409))),
      listCategories: jest.fn(async () => [
        { id: 'c-sport', name: '運動', color: '#73B062', icon: 'dumbbell', position: 1 } as Category,
        { ...existing, id: 'sub-other-parent', parentId: 'c-food' },
        existing,
      ]),
    });
    const result = await saveEntry(intent({ pendingSubcategoryName: ' 夜跑 ' }), deps);

    expect(deps.createEntry).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ subcategoryId: 'sub-existing' }),
    );
    expect(result.kind).toBe('saved');
    expect('createdSubcategory' in result && result.createdSubcategory?.id).toBe('sub-existing');
  });

  it('a made Subcategory still reports when the Entry write then fails', async () => {
    const deps = fakeDeps({ createEntry: jest.fn(async () => Promise.reject(new Error('net'))) });
    const result = await saveEntry(intent({ pendingSubcategoryName: '夜跑' }), deps);

    expect(result.kind).toBe('entryFailed');
    expect('createdSubcategory' in result && result.createdSubcategory?.id).toBe('sub-1');
    // The Draft no longer carries the pending name — the Subcategory exists.
    const kept = (deps.saveDraft as jest.Mock).mock.calls[0][0];
    expect(kept.pendingSubcategoryName).toBeUndefined();
    expect(kept.subcategoryId).toBe('sub-1');
  });
});

describe('replay reconcile (#17)', () => {
  it('pushes newer values onto a replayed original', async () => {
    const deps = fakeDeps({
      createEntry: jest.fn(async () => ({
        id: 'e-orig',
        date: '2026-08-19',
        position: 1,
        categoryId: 'c-sport',
        authorId: 'u1',
        content: 'v1|{"older words"}',
      })),
    });
    const result = await saveEntry(intent(), deps);

    expect(result).toEqual({ kind: 'saved', entryId: 'e-orig' });
    expect(deps.updateEntry).toHaveBeenCalledWith(
      'tok',
      'e-orig',
      expect.objectContaining({ content: 'v1|{"blob"}' }),
    );
  });

  it('leaves an identical replay alone', async () => {
    const deps = fakeDeps();
    await saveEntry(intent(), deps);
    expect(deps.updateEntry).not.toHaveBeenCalled();
  });

  it('reconciles a moved date', async () => {
    const deps = fakeDeps({
      createEntry: jest.fn(async (_token, body) => ({
        id: 'e-orig',
        date: '2026-08-12',
        position: 1,
        categoryId: body.categoryId,
        authorId: 'u1',
        content: body.content,
      })),
    });
    await saveEntry(intent({ date: '2026-08-19' }), deps);
    expect(deps.updateEntry).toHaveBeenCalledWith(
      'tok',
      'e-orig',
      expect.objectContaining({ date: '2026-08-19' }),
    );
  });

  it('reconciles a changed Category', async () => {
    const deps = fakeDeps({
      createEntry: jest.fn(async (_token, body) => ({
        id: 'e-orig',
        date: body.date,
        position: 1,
        categoryId: 'c-food',
        authorId: 'u1',
        content: body.content,
      })),
    });
    await saveEntry(intent({ categoryId: 'c-sport' }), deps);
    expect(deps.updateEntry).toHaveBeenCalledWith(
      'tok',
      'e-orig',
      expect.objectContaining({ categoryId: 'c-sport' }),
    );
  });

  it('reconciles a refinement the original lacks', async () => {
    const deps = fakeDeps({
      createEntry: jest.fn(async (_token, body) => ({
        id: 'e-orig',
        date: body.date,
        position: 1,
        categoryId: body.categoryId,
        authorId: 'u1',
        content: body.content,
        // replayed original has no subcategoryId
      })),
    });
    await saveEntry(intent({ subcategoryId: 'sub-7' }), deps);
    expect(deps.updateEntry).toHaveBeenCalledWith(
      'tok',
      'e-orig',
      expect.objectContaining({ subcategoryId: 'sub-7' }),
    );
  });
});

describe('photos', () => {
  it('uploads staged photos after the Entry lands', async () => {
    const deps = fakeDeps();
    const result = await saveEntry(intent({ photos: [photo] }), deps);

    expect(deps.uploadPhotos).toHaveBeenCalledWith('tok', 'e-1', [photo]);
    expect(result.kind).toBe('saved');
  });

  it('skips the upload when nothing is staged', async () => {
    const deps = fakeDeps();
    await saveEntry(intent(), deps);
    expect(deps.uploadPhotos).not.toHaveBeenCalled();
  });

  it('a failed upload keeps the Draft pinned and reports the saved Entry', async () => {
    const deps = fakeDeps({ uploadPhotos: jest.fn(async () => Promise.reject(new Error('net'))) });
    const result = await saveEntry(intent({ photos: [photo] }), deps);

    expect(result).toEqual({ kind: 'photosFailed', entryId: 'e-1' });
    expect(deps.clearDraft).not.toHaveBeenCalled();
    expect(deps.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ entryId: 'e-1', photos: [photo] }),
    );
  });

  it('a made Subcategory still reports when only the photos fail', async () => {
    const deps = fakeDeps({ uploadPhotos: jest.fn(async () => Promise.reject(new Error('net'))) });
    const result = await saveEntry(
      intent({ photos: [photo], pendingSubcategoryName: '夜跑' }),
      deps,
    );

    expect(result.kind).toBe('photosFailed');
    expect('createdSubcategory' in result && result.createdSubcategory?.id).toBe('sub-1');
  });
});
