// Pure month-grid math, ported from the design canvas's MonthGrid so the
// implementation lays out exactly what the mocks show. Months are 1-12.

export type WeekCell = { day: number; outside: boolean };

/** Weeks starting on Sunday, padded with outside days from the neighbors. */
export function buildWeeks(year: number, month: number): WeekCell[][] {
  const start = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const prevDays = new Date(year, month - 1, 0).getDate();
  const cells: WeekCell[] = [];
  for (let i = start - 1; i >= 0; i--) cells.push({ day: prevDays - i, outside: true });
  for (let day = 1; day <= days; day++) cells.push({ day, outside: false });
  let next = 1;
  while (cells.length % 7 !== 0) cells.push({ day: next++, outside: true });
  const weeks: WeekCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Week rows a month occupies: leading blanks plus its days, over seven. */
export function weekRows(year: number, month: number): number {
  const start = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  return Math.ceil((start + days) / 7);
}

/** Up to max dots in entry order; the rest collapse into "+n", never a fifth dot. */
export function dayDots<T>(items: T[], max: number): { shown: T[]; overflow: number } {
  const shown = items.slice(0, max);
  return { shown, overflow: items.length - shown.length };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const shifted = new Date(year, month - 1 + delta, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 };
}

/** The device's local date as YYYY-MM-DD (an Entry date is a calendar day). */
export function localDateString(date: Date): string {
  return `${monthKey(date.getFullYear(), date.getMonth() + 1)}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The date delta days from a YYYY-MM-DD date, as YYYY-MM-DD. */
export function shiftDay(date: string, delta: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return localDateString(new Date(year, month - 1, day + delta));
}
