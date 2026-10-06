import { weekRows } from './monthMath';
import {
  monthsInRow,
  openingRow,
  ribbonSpan,
  rowMetrics,
  rowOfMonth,
  startsYear,
} from './ribbon';

/** A stand-in MiniMonth: tall in proportion to the weeks it needs. */
const monthHeight = (year: number, month: number) => 20 + weekRows(year, month) * 10;

const span = ribbonSpan(2026);

describe('ribbonSpan', () => {
  it('covers ±150 years as a fixed number of two-month rows', () => {
    expect(span.baseYear).toBe(1876);
    // 301 years × 12 months ÷ 2 per row.
    expect(span.rowCount).toBe(1806);
  });
});

describe('monthsInRow', () => {
  it('pairs months left to right and runs straight across the year boundary', () => {
    const firstRow = monthsInRow(span, 0);
    expect(firstRow).toEqual([
      { year: 1876, month: 1 },
      { year: 1876, month: 2 },
    ]);
    // December closes a row and January opens the next, with no page between
    // them — the continuity the ribbon exists for (#51).
    const december = rowOfMonth(span, 2026, 12);
    expect(monthsInRow(span, december)).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
    ]);
    expect(monthsInRow(span, december + 1)).toEqual([
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
  });
});

describe('rowOfMonth', () => {
  it('round-trips against monthsInRow for every month of a year', () => {
    for (let month = 1; month <= 12; month += 1) {
      const row = rowOfMonth(span, 2026, month);
      expect(monthsInRow(span, row)).toContainEqual({ year: 2026, month });
    }
  });
});

describe('weekRows', () => {
  it('counts the rows a mini month actually needs', () => {
    // February 2026 starts on a Sunday and has 28 days: exactly four rows.
    expect(weekRows(2026, 2)).toBe(4);
    // August 2026 starts on a Saturday, so its 31 days spill to six.
    expect(weekRows(2026, 8)).toBe(6);
  });
});

describe('rowMetrics', () => {
  const sizes = { monthHeight, gap: 8, yearCaption: 30, topPadding: 16 };

  it('makes a row as tall as its tallest month', () => {
    const { heights } = rowMetrics(span, sizes);
    // March/April: mid-year, so no caption in the measurement.
    const row = rowOfMonth(span, 2026, 3);
    const tallest = Math.max(monthHeight(2026, 3), monthHeight(2026, 4));
    expect(heights[row]).toBe(tallest + 8);
  });

  it('offsets are the running sum, so a scroll target is exact not approximate', () => {
    const { heights, offsets, total } = rowMetrics(span, sizes);
    // Offsets start at the content container's top padding: they are measured
    // from the top of the content view, which that padding shifts. Starting at
    // 0 put every scroll target short by exactly that much.
    expect(offsets[0]).toBe(16);
    expect(offsets[1]).toBe(16 + heights[0]);
    expect(offsets[5]).toBe(16 + heights.slice(0, 5).reduce((a, b) => a + b, 0));
    expect(total).toBe(16 + heights.reduce((a, b) => a + b, 0));
  });

  it('never assumes a uniform row height', () => {
    const { heights } = rowMetrics(span, sizes);
    // If every row were the same the precomputation would be pointless, and
    // padding mini months to six rows would have been the cheaper design.
    expect(new Set(heights).size).toBeGreaterThan(1);
  });
});

describe('startsYear', () => {
  it('marks the row January opens, and only that row', () => {
    expect(startsYear(rowOfMonth(span, 2026, 1))).toBe(true);
    expect(startsYear(rowOfMonth(span, 2026, 3))).toBe(false);
    expect(startsYear(rowOfMonth(span, 2026, 12))).toBe(false);
    expect(startsYear(rowOfMonth(span, 2027, 1))).toBe(true);
  });

  it('a captioned row is taller by exactly the caption', () => {
    const sizes = { monthHeight, gap: 8, yearCaption: 30, topPadding: 16 };
    const { heights } = rowMetrics(span, sizes);
    const january = rowOfMonth(span, 2027, 1);
    const tallest = Math.max(monthHeight(2027, 1), monthHeight(2027, 2));
    expect(heights[january]).toBe(tallest + 8 + 30);
  });
});

describe('openingRow', () => {
  it('sits one row above the month, so the recent past is on screen', () => {
    expect(openingRow(span, 2026, 10)).toBe(rowOfMonth(span, 2026, 10) - 1);
  });

  it('never runs off the top of the list', () => {
    expect(openingRow(span, span.baseYear, 1)).toBe(0);
  });
});

describe('rowOfMonth clamping', () => {
  it('never returns a row outside the list', () => {
    // scrollToIndex invariants on the range and THROWS rather than calling
    // onScrollToIndexFailed, so a year past either end must land on the
    // nearest row instead of crashing the surface.
    expect(rowOfMonth(span, span.baseYear - 50, 1)).toBe(0);
    expect(rowOfMonth(span, 3000, 12)).toBe(span.rowCount - 1);
    expect(rowOfMonth(span, 2026, 10)).toBeGreaterThan(0);
    expect(rowOfMonth(span, 2026, 10)).toBeLessThan(span.rowCount);
  });
});
