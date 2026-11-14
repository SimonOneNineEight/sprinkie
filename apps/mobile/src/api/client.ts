import type { paths } from './types.gen';

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export type Me = paths['/me']['post']['responses']['200']['content']['application/json'];
export type Category = Me['categories'][number];
export type CreateEntryBody =
  paths['/entries']['post']['requestBody']['content']['application/json'];
export type Entry = paths['/entries']['post']['responses']['201']['content']['application/json'];
type EntryList = paths['/entries']['get']['responses']['200']['content']['application/json'];
export type MonthDots =
  paths['/months/{month}']['get']['responses']['200']['content']['application/json'];
export type CreateCategoryBody =
  paths['/categories']['post']['requestBody']['content']['application/json'];

/** A non-2xx API answer; status lets callers branch (403 = deactivated). */
export class ApiError extends Error {
  status: number;

  constructor(path: string, status: number) {
    super(`${path} responded ${status}`);
    this.status = status;
  }
}

async function request<T>(
  accessToken: string,
  path: string,
  init: { method?: string; body?: object } = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) {
    throw new ApiError(path, response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

type ProvisionLanguage = NonNullable<
  NonNullable<paths['/me']['post']['requestBody']>['content']['application/json']['language']
>;

/**
 * Idempotent: provisions the signed-in User's world on first sign-in. The
 * resolved App Language is a one-time seeding hint naming the Starter
 * Categories (#36); the server ignores it once Categories exist.
 */
export function provisionMe(accessToken: string, language: ProvisionLanguage): Promise<Me> {
  return request<Me>(accessToken, '/me', { method: 'POST', body: { language } });
}

/** Deactivates the account (#15); the permanent purge follows 30 days later. */
export function deactivateMe(accessToken: string): Promise<void> {
  return request<void>(accessToken, '/me', { method: 'DELETE' });
}

/** The deliberate restore of a deactivated account within its grace. */
export function reactivateMe(accessToken: string): Promise<Me> {
  return request<Me>(accessToken, '/me/reactivate', { method: 'POST' });
}

export function createEntry(accessToken: string, body: CreateEntryBody): Promise<Entry> {
  return request<Entry>(accessToken, '/entries', { method: 'POST', body });
}

export function listEntries(accessToken: string, date: string): Promise<EntryList> {
  return request<EntryList>(accessToken, `/entries?date=${date}`);
}

export type FilterParams = { filterCategories: string[]; filterSubcategoryExceptions: string[] };

function filterQuery(filter?: FilterParams): string {
  if (!filter) return '';
  const parts: string[] = [];
  if (filter.filterCategories.length > 0) {
    parts.push(`filterCategories=${filter.filterCategories.join(',')}`);
  }
  if (filter.filterSubcategoryExceptions.length > 0) {
    parts.push(`filterSubcategoryExceptions=${filter.filterSubcategoryExceptions.join(',')}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function getMonth(
  accessToken: string,
  month: string,
  filter?: FilterParams,
): Promise<MonthDots> {
  return request<MonthDots>(accessToken, `/months/${month}${filterQuery(filter)}`);
}

export type YearColors = paths['/years/{year}']['get']['responses']['200']['content']['application/json'];

export function getYear(
  accessToken: string,
  year: string,
  filter?: FilterParams,
): Promise<YearColors> {
  return request<YearColors>(accessToken, `/years/${year}${filterQuery(filter)}`);
}

type UpdateEntryBody =
  paths['/entries/{id}']['patch']['requestBody']['content']['application/json'];

export function updateEntry(accessToken: string, id: string, body: UpdateEntryBody): Promise<Entry> {
  return request<Entry>(accessToken, `/entries/${id}`, { method: 'PATCH', body });
}

export function deleteEntry(accessToken: string, id: string): Promise<void> {
  return request<void>(accessToken, `/entries/${id}`, { method: 'DELETE' });
}

export function reorderDay(accessToken: string, date: string, entryIds: string[]): Promise<EntryList> {
  return request<EntryList>(accessToken, `/days/${date}/order`, { method: 'PUT', body: { entryIds } });
}

export function createCategory(accessToken: string, body: CreateCategoryBody): Promise<Category> {
  return request<Category>(accessToken, '/categories', { method: 'POST', body });
}

export type Photo = NonNullable<Entry['photos']>[number];
type PhotoUploads =
  paths['/entries/{id}/photos/presign']['post']['responses']['200']['content']['application/json'];
type PhotoList =
  paths['/entries/{id}/photos']['post']['responses']['201']['content']['application/json'];
type RegisterPhotoBody =
  paths['/entries/{id}/photos']['post']['requestBody']['content']['application/json']['photos'][number];

export function presignPhotos(accessToken: string, entryId: string, count: number): Promise<PhotoUploads> {
  return request<PhotoUploads>(accessToken, `/entries/${entryId}/photos/presign`, {
    method: 'POST',
    body: { count },
  });
}

export function registerPhotos(
  accessToken: string,
  entryId: string,
  photos: RegisterPhotoBody[],
): Promise<PhotoList> {
  return request<PhotoList>(accessToken, `/entries/${entryId}/photos`, {
    method: 'POST',
    body: { photos },
  });
}

export function deletePhoto(accessToken: string, id: string): Promise<void> {
  return request<void>(accessToken, `/photos/${id}`, { method: 'DELETE' });
}

export function reorderPhotos(accessToken: string, entryId: string, photoIds: string[]): Promise<PhotoList> {
  return request<PhotoList>(accessToken, `/entries/${entryId}/photos/order`, {
    method: 'PUT',
    body: { photoIds },
  });
}

type UpdateCategoryBody =
  paths['/categories/{id}']['patch']['requestBody']['content']['application/json'];

export function updateCategory(
  accessToken: string,
  id: string,
  body: UpdateCategoryBody,
): Promise<Category> {
  return request<Category>(accessToken, `/categories/${id}`, { method: 'PATCH', body });
}

export function deleteCategory(accessToken: string, id: string): Promise<void> {
  return request<void>(accessToken, `/categories/${id}`, { method: 'DELETE' });
}

type ColorRecents = paths['/color-recents']['get']['responses']['200']['content']['application/json'];

/** Saved custom colors, most-recent first (the color drawer's recents row). */
export function listColorRecents(accessToken: string): Promise<ColorRecents> {
  return request<ColorRecents>(accessToken, '/color-recents');
}

/** LRU save: an existing color moves to the front; the cap evicts the oldest. */
export function saveColorRecent(accessToken: string, color: string): Promise<ColorRecents> {
  return request<ColorRecents>(accessToken, '/color-recents', { method: 'PUT', body: { color } });
}

/**
 * Forgets a Saved Color (#47). The six digits travel bare — a "#" in a path
 * would have to be percent-encoded — and the server matches case-insensitively,
 * so the stored "#AB12CD" answers to whatever case the drawer holds.
 */
export function forgetColorRecent(accessToken: string, color: string): Promise<void> {
  return request<void>(accessToken, `/color-recents/${color.replace('#', '')}`, {
    method: 'DELETE',
  });
}
