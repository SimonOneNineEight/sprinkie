import type { StringCatalog } from '../i18n/appLanguage';
import { theme } from '../theme';

// The Onboarding's made-up Journal (#139): for show only, never written. A
// fixed pattern seeded by the date, so the same day draws the same calendar
// on every visit.

export type SampleCategory = { id: string; name: string; icon: string; color: string };

export function sampleCategories(strings: StringCatalog): SampleCategory[] {
  const names = strings.onboarding.sampleCategories;
  const c = theme.categories;
  return [
    { id: 'work', name: names.work, icon: 'briefcase', color: c.blue.base },
    { id: 'food', name: names.food, icon: 'utensils', color: c.orange.base },
    { id: 'move', name: names.move, icon: 'dumbbell', color: c.green.base },
    { id: 'friends', name: names.friends, icon: 'users', color: c.pink.base },
    { id: 'read', name: names.read, icon: 'book-open', color: c.indigo.base },
  ];
}

function pseudo(n: number) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** A sample day's Categories, by index into sampleCategories: none to three. */
function sampleDay(year: number, month: number, day: number): number[] {
  const count = Math.floor(pseudo(year * 400 + month * 31 + day) * 4);
  const picks = Array.from({ length: count }, (_, i) => Math.floor(pseudo(day * 7 + i + month) * 5));
  return [...new Set(picks)];
}

/**
 * A sample month's dots up to `lastDay`, day number → colors, showing only
 * `only`'s days when one is chosen.
 */
export function sampleMonth(
  categories: SampleCategory[],
  year: number,
  month: number,
  lastDay: number,
  only: string | null,
): Record<number, string[]> {
  const days: Record<number, string[]> = {};
  for (let day = 1; day <= lastDay; day++) {
    const shown = sampleDay(year, month, day)
      .map((i) => categories[i])
      .filter((category) => only === null || category.id === only);
    if (shown.length > 0) days[day] = shown.map((category) => category.color);
  }
  return days;
}

/** A sample year's month up to today: day number → its first color. */
export function sampleYearMonth(
  categories: SampleCategory[],
  year: number,
  month: number,
  today: { month: number; day: number },
): Record<number, string> {
  if (month > today.month) return {};
  const lastDay = month === today.month ? today.day : 31;
  const colors: Record<number, string> = {};
  for (const [day, dots] of Object.entries(sampleMonth(categories, year, month, lastDay, null))) {
    colors[Number(day)] = dots[0];
  }
  return colors;
}
