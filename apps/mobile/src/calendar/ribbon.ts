// Geometry for the year ribbon (#51). The surface is one virtualised list of
// month rows running continuously across years, so every scroll target —
// today on open, a year from the wheel, the month ‹年 came from — is a row
// index, and the list needs each row's exact height to land on it rather than
// near it.
//
// Mini months are 4, 5 or 6 week-rows tall depending on where the first of the
// month falls, so rows are NOT uniform. Padding them to a fixed six would make
// the arithmetic trivial and change how short months look, which the canvas
// does not say to do. The heights are deterministic instead, so this module
// precomputes them once and hands FlatList exact offsets.

/** ±150 years, the span the year wheel already uses (#27). */
export const SPAN_YEARS = 150;
export const MONTHS_PER_ROW = 2;

export type RibbonSpan = {
  /** First year in the list. */
  baseYear: number;
  /** Rows in the whole list. */
  rowCount: number;
};

export function ribbonSpan(centerYear: number): RibbonSpan {
  const years = SPAN_YEARS * 2 + 1;
  return { baseYear: centerYear - SPAN_YEARS, rowCount: (years * 12) / MONTHS_PER_ROW };
}

/** The months sitting in one row, left to right. */
export function monthsInRow(span: RibbonSpan, row: number): { year: number; month: number }[] {
  return Array.from({ length: MONTHS_PER_ROW }, (_, i) => {
    const absolute = row * MONTHS_PER_ROW + i;
    return { year: span.baseYear + Math.floor(absolute / 12), month: (absolute % 12) + 1 };
  });
}

/** The row holding a given month, clamped into the list. */
export function rowOfMonth(span: RibbonSpan, year: number, month: number): number {
  const absolute = (year - span.baseYear) * 12 + (month - 1);
  const row = Math.floor(absolute / MONTHS_PER_ROW);
  // Clamped because scrollToIndex invariants on the range and throws rather
  // than calling onScrollToIndexFailed: a year outside the span must scroll to
  // the nearest end, never crash the surface.
  return Math.min(Math.max(row, 0), span.rowCount - 1);
}

/** Rows per year, which is where a year caption falls. */
const ROWS_PER_YEAR = 12 / MONTHS_PER_ROW;

/**
 * A row that opens a year, so January never arrives unannounced. The ribbon
 * runs straight through the boundary by design (#51), which on screen left
 * December and January indistinguishable; a caption marks the crossing
 * without reinstating the page it replaced.
 */
export function startsYear(row: number): boolean {
  return row % ROWS_PER_YEAR === 0;
}

/**
 * The row to open on. `rowOfMonth` alone puts the month flush against the top
 * of the viewport, leaving the whole past behind an upward scroll, so the
 * opening sits one row earlier: the recent past is the direction a journal is
 * read in.
 */
export function openingRow(span: RibbonSpan, year: number, month: number): number {
  return Math.max(0, rowOfMonth(span, year, month) - 1);
}

/**
 * Exact row offsets. A row is as tall as its tallest month, so a 4-row
 * February beside a 6-row March gives a 6-row row. Measurements come from the
 * caller because they are theme tokens, which this module deliberately does
 * not reach into.
 */
export function rowMetrics(
  span: RibbonSpan,
  sizes: {
    /** A month's own rendered height. Passed in rather than rebuilt here:
     * MiniMonth owns those tokens, and reconstructing them meant a margin
     * changed there silently shortened every offset here. */
    monthHeight: (year: number, month: number) => number;
    gap: number;
    yearCaption: number;
    /** The list's contentContainer paddingTop: offsets are measured from the
     * top of the content view, which that padding shifts. Without it every
     * scroll target lands short by exactly this much. */
    topPadding: number;
  },
) {
  const heights = new Array<number>(span.rowCount);
  const offsets = new Array<number>(span.rowCount);
  let running = sizes.topPadding;
  for (let row = 0; row < span.rowCount; row += 1) {
    const tallest = monthsInRow(span, row).reduce(
      (most, { year, month }) => Math.max(most, sizes.monthHeight(year, month)),
      0,
    );
    heights[row] = tallest + sizes.gap + (startsYear(row) ? sizes.yearCaption : 0);
    offsets[row] = running;
    running += heights[row];
  }
  return { heights, offsets, total: running };
}
