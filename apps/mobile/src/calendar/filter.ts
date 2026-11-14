import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FilterParams } from '../api/client';

// The Filter (#134, GLOSSARY.md, ADR-0008): what the User chose to see. An
// empty Filter shows everything. Choosing a Category chooses its whole
// family; a Subcategory then toggles on its own, and the Category's own
// choice covers its unrefined Entries. Lives for the session, never stored.
//
// A Subcategory is chosen when its Category is, unless it is listed in
// subcategoryIds, which records only the Subcategories that differ from
// their Category. So one created later under a chosen Category is chosen
// with no bookkeeping, and ids of deleted categories match nothing.
export type Filter = {
  categoryIds: string[];
  subcategoryIds: string[];
};

export const noFilter: Filter = { categoryIds: [], subcategoryIds: [] };

type CategoryLike = { id: string; parentId?: string | null };

export function isChosen(filter: Filter, category: CategoryLike): boolean {
  if (!category.parentId) return filter.categoryIds.includes(category.id);
  return filter.categoryIds.includes(category.parentId) !== filter.subcategoryIds.includes(category.id);
}

/** True when anything current is chosen: the calendar shows only that. */
export function isFiltering(filter: Filter, categories: CategoryLike[]): boolean {
  return categories.some((c) => isChosen(filter, c));
}

/** The family switch: on chooses the Category and every child, off clears them all. */
export function toggleCategory(
  filter: Filter,
  category: CategoryLike,
  children: CategoryLike[],
): Filter {
  const childIds = children.map((child) => child.id);
  const chosen = filter.categoryIds.includes(category.id);
  return {
    categoryIds: chosen
      ? filter.categoryIds.filter((id) => id !== category.id)
      : [...filter.categoryIds, category.id],
    subcategoryIds: filter.subcategoryIds.filter((id) => !childIds.includes(id)),
  };
}

export function toggleSubcategory(filter: Filter, id: string): Filter {
  return {
    categoryIds: filter.categoryIds,
    subcategoryIds: filter.subcategoryIds.includes(id)
      ? filter.subcategoryIds.filter((x) => x !== id)
      : [...filter.subcategoryIds, id],
  };
}

type EntryLike = { categoryId: string; subcategoryId?: string | null };

/**
 * Whether an Entry shows under the Filter, for surfaces holding full Entries
 * (the day panel, the day view). It reads only the Entry's own ids, never a
 * Category list, so a Subcategory the app has not loaded still follows its
 * Category (ADR-0010).
 */
export function entryIsShown(entry: EntryLike, filter: Filter): boolean {
  if (filter.categoryIds.length === 0 && filter.subcategoryIds.length === 0) return true;
  const categoryChosen = filter.categoryIds.includes(entry.categoryId);
  if (entry.subcategoryId == null) return categoryChosen;
  return categoryChosen !== filter.subcategoryIds.includes(entry.subcategoryId);
}

/** The Filter as the months and years endpoints take it; undefined when empty. */
export function filterParams(filter: Filter): FilterParams | undefined {
  if (filter.categoryIds.length === 0 && filter.subcategoryIds.length === 0) return undefined;
  return { filterCategories: filter.categoryIds, filterSubcategoryExceptions: filter.subcategoryIds };
}

/** A stable string for the Filter, for tagging fetched data with the Filter it answers. */
export function filterKey(filter: Filter): string {
  return `${filter.categoryIds.join(',')}|${filter.subcategoryIds.join(',')}`;
}

// #30 kept a hidden-set on the device; #134 discarded it rather than
// converting it (ADR-0008), so the old key is only ever deleted.
export function forgetStoredHidden(): Promise<void> {
  return AsyncStorage.removeItem('hiddenCategories.v1').catch(() => undefined);
}
