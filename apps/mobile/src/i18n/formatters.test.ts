import { catalogFor } from './appLanguage';

// The per-language tests in the suite (#32 testing decision; wordmark.test.ts
// is the other): word order comes from each catalog's formatter functions, so
// both languages pin their exact output here, in the style of the month-math
// tests.
const zh = catalogFor('zh-TW');
const en = catalogFor('en');

describe('date labels', () => {
  // 2026-08-12 is a Wednesday: weekday index 3.
  it('zh-TW leads with the date', () => {
    expect(zh.month.dateLabel(8, 12, 3)).toBe('8月12日 星期三');
  });

  it('English leads with the weekday', () => {
    expect(en.month.dateLabel(8, 12, 3)).toBe('Wed, Aug 12');
  });
});

describe('month and year titles', () => {
  it('zh-TW counts months and suffixes years', () => {
    expect(zh.month.title(8)).toBe('8月');
    expect(zh.month.yearLabel(2026)).toBe('2026年');
    expect(zh.year.title(2026)).toBe('2026年');
    expect(zh.year.monthLabel(8)).toBe('8月');
    expect(zh.datePicker.title(2026, 8)).toBe('2026年8月');
  });

  it('English names months and leaves years bare', () => {
    expect(en.month.title(8)).toBe('August');
    expect(en.month.yearLabel(2026)).toBe('2026');
    expect(en.year.title(2026)).toBe('2026');
    expect(en.year.monthLabel(8)).toBe('Aug');
    expect(en.datePicker.title(2026, 8)).toBe('August 2026');
  });
});

describe('entry counts', () => {
  it('zh-TW has one plural form', () => {
    expect(zh.year.countLabel(1)).toBe('今年到目前為止 1 則紀錄');
    expect(zh.year.totalLabel(3)).toBe('共 3 則紀錄');
  });

  it('English pluralizes', () => {
    expect(en.year.countLabel(1)).toBe('1 entry so far this year');
    expect(en.year.countLabel(3)).toBe('3 entries so far this year');
    expect(en.year.totalLabel(1)).toBe('1 entry in total');
    expect(en.year.totalLabel(3)).toBe('3 entries in total');
  });
});

describe('weekday names', () => {
  it('both catalogs order weekdays from Sunday, per Date#getDay', () => {
    expect(zh.month.weekdaysShort[0]).toBe('日');
    expect(zh.month.weekdaysFull[6]).toBe('星期六');
    expect(en.month.weekdaysShort[0]).toBe('Sun');
    expect(en.month.weekdaysFull[6]).toBe('Saturday');
  });

  // The shared type widened these to string[] (the price of a second
  // catalog), so the seven-day length is pinned here instead.
  it('both catalogs carry seven weekdays', () => {
    expect(zh.month.weekdaysShort).toHaveLength(7);
    expect(zh.month.weekdaysFull).toHaveLength(7);
    expect(en.month.weekdaysShort).toHaveLength(7);
    expect(en.month.weekdaysFull).toHaveLength(7);
  });
});
