import type { HiddenSet } from './hidden';
import { nothingHidden } from './hidden';

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

/**
 * The complement the surfaces apply (ADR-0009): every current Category and
 * Subcategory the Filter does not choose, sent as the API's hidden-set.
 */
export function hiddenFor(filter: Filter, categories: CategoryLike[]): HiddenSet {
  if (!isFiltering(filter, categories)) return nothingHidden;
  const unchosen = categories.filter((c) => !isChosen(filter, c));
  return {
    categoryIds: unchosen.filter((c) => !c.parentId).map((c) => c.id),
    subcategoryIds: unchosen.filter((c) => c.parentId).map((c) => c.id),
  };
}
