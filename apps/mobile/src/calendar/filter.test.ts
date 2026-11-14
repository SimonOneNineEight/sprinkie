import type { Filter } from './filter';
import {
  entryIsShown,
  filterParams,
  isChosen,
  isFiltering,
  noFilter,
  toggleCategory,
  toggleSubcategory,
} from './filter';

const sport = { id: 'c-sport' };
const gym = { id: 'c-gym', parentId: 'c-sport' };
const run = { id: 'c-run', parentId: 'c-sport' };
const work = { id: 'c-work' };
const desk = { id: 'c-desk', parentId: 'c-work' };
const all = [sport, gym, run, work, desk];

describe('what the calendar asks the API for', () => {
  it('an empty Filter sends nothing', () => {
    expect(filterParams(noFilter)).toBeUndefined();
  });

  it('a Filter travels as itself, never as its complement (ADR-0010)', () => {
    const filter = toggleSubcategory(toggleCategory(noFilter, sport, [gym, run]), 'c-gym');
    expect(filterParams(filter)).toEqual({
      filterCategories: ['c-sport'],
      filterSubcategoryExceptions: ['c-gym'],
    });
  });
});

describe('a Category and its Subcategories (#134 Q8b)', () => {
  const chosen = (filter: Filter) => all.filter((c) => isChosen(filter, c)).map((c) => c.id);

  it('turning a Category on chooses it and every Subcategory', () => {
    expect(chosen(toggleCategory(noFilter, sport, [gym, run]))).toEqual(['c-sport', 'c-gym', 'c-run']);
  });

  it('a Subcategory drops out on its own and the Category stays chosen', () => {
    const filter = toggleSubcategory(toggleCategory(noFilter, sport, [gym, run]), 'c-gym');
    expect(chosen(filter)).toEqual(['c-sport', 'c-run']);
  });

  it('turning a Category off clears its whole family', () => {
    const partial = toggleSubcategory(toggleCategory(noFilter, sport, [gym, run]), 'c-gym');
    expect(chosen(toggleCategory(partial, sport, [gym, run]))).toEqual([]);
  });

  it('turning a Category on from a lone Subcategory chooses the whole family', () => {
    const lone = toggleSubcategory(noFilter, 'c-gym');
    expect(chosen(lone)).toEqual(['c-gym']);
    expect(chosen(toggleCategory(lone, sport, [gym, run]))).toEqual(['c-sport', 'c-gym', 'c-run']);
  });

  it('a Category with every Subcategory dropped still shows its unrefined Entries', () => {
    let filter = toggleCategory(noFilter, sport, [gym, run]);
    filter = toggleSubcategory(toggleSubcategory(filter, 'c-gym'), 'c-run');
    expect(chosen(filter)).toEqual(['c-sport']);
  });

  it('choosing every Subcategory one by one does not choose the Category', () => {
    const filter = toggleSubcategory(toggleSubcategory(noFilter, 'c-gym'), 'c-run');
    expect(chosen(filter)).toEqual(['c-gym', 'c-run']);
  });
});

describe('Entries under a Filter, with no Category list (ADR-0010)', () => {
  const sportOnly = toggleCategory(noFilter, sport, [gym, run]);

  it('an empty Filter shows every Entry', () => {
    expect(entryIsShown({ categoryId: 'c-work', subcategoryId: 'c-desk' }, noFilter)).toBe(true);
  });

  it('a Subcategory the app never loaded follows its Category (#134 Q13)', () => {
    expect(entryIsShown({ categoryId: 'c-sport', subcategoryId: 'c-swim' }, sportOnly)).toBe(true);
    expect(entryIsShown({ categoryId: 'c-work', subcategoryId: 'c-meeting' }, sportOnly)).toBe(false);
  });

  it('a dropped Subcategory leaves, its Category\'s unrefined Entries stay', () => {
    const filter = toggleSubcategory(sportOnly, 'c-gym');
    expect(entryIsShown({ categoryId: 'c-sport', subcategoryId: 'c-gym' }, filter)).toBe(false);
    expect(entryIsShown({ categoryId: 'c-sport' }, filter)).toBe(true);
  });

  it('a lone Subcategory shows its Entries but not its Category\'s unrefined ones', () => {
    const filter = toggleSubcategory(noFilter, 'c-gym');
    expect(entryIsShown({ categoryId: 'c-sport', subcategoryId: 'c-gym' }, filter)).toBe(true);
    expect(entryIsShown({ categoryId: 'c-sport' }, filter)).toBe(false);
    expect(entryIsShown({ categoryId: 'c-work' }, filter)).toBe(false);
  });
});

describe('a Filter whose choices were deleted', () => {
  it('is no Filter', () => {
    const filter = toggleSubcategory(toggleCategory(noFilter, { id: 'c-gone' }, []), 'c-gone-too');
    expect(isFiltering(filter, all)).toBe(false);
  });
});
