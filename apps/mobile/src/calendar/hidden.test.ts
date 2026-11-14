import { entryIsVisible, hiddenParams, nothingHidden } from './hidden';

describe('entry visibility', () => {
  it('an unrefined entry follows its category', () => {
    const hidden = { categoryIds: ['c-sport'], subcategoryIds: [] };
    expect(entryIsVisible({ categoryId: 'c-sport' }, hidden)).toBe(false);
    expect(entryIsVisible({ categoryId: 'c-work' }, hidden)).toBe(true);
  });

  it('a refined entry follows its subcategory, even under a hidden parent', () => {
    const hidden = { categoryIds: ['c-sport'], subcategoryIds: ['c-run'] };
    expect(entryIsVisible({ categoryId: 'c-sport', subcategoryId: 'c-gym' }, hidden)).toBe(true);
    expect(entryIsVisible({ categoryId: 'c-sport', subcategoryId: 'c-run' }, hidden)).toBe(false);
  });
});

describe('API params', () => {
  it('is undefined when nothing is hidden, the id lists otherwise', () => {
    expect(hiddenParams(nothingHidden)).toBeUndefined();
    expect(hiddenParams({ categoryIds: ['c-work'], subcategoryIds: ['c-gym'] })).toEqual({
      hiddenCategories: ['c-work'],
      hiddenSubcategories: ['c-gym'],
    });
  });
});
