import AsyncStorage from '@react-native-async-storage/async-storage';

import type { HiddenParams } from '../api/client';

// The hidden-set the calendar surfaces apply (ADR-0009): since #134 it is
// the Filter's complement (filter.ts), no longer something the User sets.
// A refined Entry follows its Subcategory, an unrefined one its Category.

export type HiddenSet = {
  categoryIds: string[];
  subcategoryIds: string[];
};

export const nothingHidden: HiddenSet = { categoryIds: [], subcategoryIds: [] };

type EntryLike = { categoryId: string; subcategoryId?: string | null };

export function hasHidden(hidden: HiddenSet): boolean {
  return hidden.categoryIds.length > 0 || hidden.subcategoryIds.length > 0;
}

/** Client-side visibility for surfaces that hold full entries (day, panel). */
export function entryIsVisible(entry: EntryLike, hidden: HiddenSet): boolean {
  if (entry.subcategoryId != null) {
    return !hidden.subcategoryIds.includes(entry.subcategoryId);
  }
  return !hidden.categoryIds.includes(entry.categoryId);
}

/** The API's hidden-set query params; undefined when nothing is hidden. */
/**
 * A stable string for the hidden-set, for tagging cached data with the
 * visibility it answers. MonthScreen's dots and the year ribbon both need it;
 * ADR-0005 keeps visibility per-surface, so this shares the one expression
 * rather than introducing the visible-world module that ADR rejected.
 */
export function hiddenKey(hidden: HiddenSet): string {
  return `${hidden.categoryIds.join(',')}|${hidden.subcategoryIds.join(',')}`;
}

export function hiddenParams(hidden: HiddenSet): HiddenParams | undefined {
  if (!hasHidden(hidden)) return undefined;
  return { hiddenCategories: hidden.categoryIds, hiddenSubcategories: hidden.subcategoryIds };
}

// #30 kept the hidden-set on the device; #134 discarded it rather than
// converting it (ADR-0008), so the old key is only ever deleted.
export function forgetStoredHidden(): Promise<void> {
  return AsyncStorage.removeItem('hiddenCategories.v1').catch(() => undefined);
}
