import type { Filter } from './filter';
import {
  hiddenFor,
  isChosen,
  isFiltering,
  noFilter,
  toggleCategory,
  toggleSubcategory,
} from './filter';
import { entryIsVisible, nothingHidden } from './hidden';

const sport = { id: 'c-sport' };
const gym = { id: 'c-gym', parentId: 'c-sport' };
const run = { id: 'c-run', parentId: 'c-sport' };
const work = { id: 'c-work' };
const desk = { id: 'c-desk', parentId: 'c-work' };
const all = [sport, gym, run, work, desk];

describe('what the calendar hides', () => {
  it('an empty Filter hides nothing', () => {
    expect(hiddenFor(noFilter, all)).toEqual(nothingHidden);
  });

  it('choosing a Category hides every other family', () => {
    const filter = toggleCategory(noFilter, sport, [gym, run]);
    expect(hiddenFor(filter, all)).toEqual({ categoryIds: ['c-work'], subcategoryIds: ['c-desk'] });
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

describe('the Filter against a changing Category list', () => {
  it('a Subcategory created under a chosen Category joins the Filter (#134 Q13)', () => {
    const filter = toggleCategory(noFilter, sport, [gym, run]);
    const swim = { id: 'c-swim', parentId: 'c-sport' };
    expect(hiddenFor(filter, [...all, swim]).subcategoryIds).not.toContain('c-swim');
  });

  it('a Subcategory created under an unchosen Category stays out', () => {
    const filter = toggleCategory(noFilter, sport, [gym, run]);
    const meeting = { id: 'c-meeting', parentId: 'c-work' };
    expect(hiddenFor(filter, [...all, meeting]).subcategoryIds).toContain('c-meeting');
  });

  it('a Filter holding only deleted categories is no Filter', () => {
    const filter = toggleSubcategory(toggleCategory(noFilter, { id: 'c-gone' }, []), 'c-gone-too');
    expect(isFiltering(filter, all)).toBe(false);
    expect(hiddenFor(filter, all)).toEqual(nothingHidden);
  });
});

describe('Entries under a Filter', () => {
  it('a lone Subcategory shows its Entries but not its Category\'s unrefined ones', () => {
    const hidden = hiddenFor(toggleSubcategory(noFilter, 'c-gym'), all);
    expect(entryIsVisible({ categoryId: 'c-sport', subcategoryId: 'c-gym' }, hidden)).toBe(true);
    expect(entryIsVisible({ categoryId: 'c-sport' }, hidden)).toBe(false);
    expect(entryIsVisible({ categoryId: 'c-work' }, hidden)).toBe(false);
  });
});
