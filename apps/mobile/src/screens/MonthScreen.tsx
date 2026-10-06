import { ChevronLeft, Settings, Tags } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import type { Category } from '../api/client';
import { getMonth, listEntries } from '../api/client';
import type { PanelEntry } from '../calendar/DayPanel';
import { DayPanel } from '../calendar/DayPanel';
import type { HiddenSet } from '../calendar/hidden';
import { entryIsVisible, hiddenParams, nothingHidden } from '../calendar/hidden';
import { CalendarFloatingActions, useFloatingActions } from '../calendar/CalendarFloatingActions';
import { CategorySheet } from '../calendar/CategorySheet';
import { MonthGrid } from '../calendar/MonthGrid';
import { monthKey, shiftMonth } from '../calendar/monthMath';
import { decodeContent } from '../entries/content';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

type Props = {
  accessToken: string;
  categories: Category[];
  /** Injectable for tests; defaults to the device's now. */
  today?: Date;
  onOpenDay: (date: string) => void;
  /** Opens the entry form for the selected date (#23). */
  onAddEntry: (date: string) => void;
  /** Opens settings (#15). */
  onOpenSettings?: () => void;
  /** Fired after the 類別 sheet changes a category, so /me refetches. */
  onCategoriesChanged?: () => void;
  /** Opens the year view (#12) on the month being viewed — Apple's zoom-out
   * rather than a back-stack (#40). The ribbon scrolls to that exact month,
   * which is more precise than the year-level landing it replaces (#51). */
  onOpenYear?: (year: number, month: number) => void;
  /** Land on this month instead of today's (year view tap-through, #12). */
  initialMonth?: { year: number; month: number };
  /** The persistent hidden-set (#30), owned by HomeScreen. */
  hidden?: HiddenSet;
  onChangeHidden?: (hidden: HiddenSet) => void;
  /** Bump to refetch the visible month (after a save elsewhere). */
  refresh?: number;
};

function dateString(year: number, month: number, day: number): string {
  return `${monthKey(year, month)}-${String(day).padStart(2, '0')}`;
}

// The app's face (#6): the month grid with dots, the selected-day panel, and
// the persistent +. Swipe and chevrons both move months.
export function MonthScreen({
  accessToken,
  categories,
  today = new Date(),
  onOpenDay,
  onAddEntry,
  onOpenSettings,
  onCategoriesChanged,
  onOpenYear,
  initialMonth,
  hidden = nothingHidden,
  onChangeHidden,
  refresh = 0,
}: Props) {
  const strings = useStrings();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { visible: actionsVisible, scrollHandlers, clearance } = useFloatingActions();
  const todayParts = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
  const landsOnToday =
    !initialMonth ||
    (initialMonth.year === todayParts.year && initialMonth.month === todayParts.month);
  const [view, setView] = useState({
    year: initialMonth?.year ?? todayParts.year,
    month: initialMonth?.month ?? todayParts.month,
    day: landsOnToday ? todayParts.day : 1,
  });
  const visible = { year: view.year, month: view.month };
  const selectedDay = view.day;
  // Dots carry the request they answer (#40 item 8), not just the month.
  // Both the pager and the hidden-set move the grid out from under an
  // in-flight fetch: the pager moves `visible` the instant a swipe settles,
  // and hiding a Category refetches the same month. Untagged, the last
  // answer keeps painting onto a grid it never described — the month you
  // just left, or the Categories you just hid. null means nothing fetched.
  const [dots, setDots] = useState<{ key: string | null; byDay: Record<number, string[]> }>({
    key: null,
    byDay: {},
  });
  const [panelEntries, setPanelEntries] = useState<PanelEntry[]>([]);

  const visibleKey = monthKey(visible.year, visible.month);
  // What the dots on screen have to answer: this month, under this hidden-set.
  const dotsKey = `${visibleKey}|${hidden.categoryIds.join(',')}|${hidden.subcategoryIds.join(',')}`;
  const selectedDate = dateString(visible.year, visible.month, selectedDay);
  const categoryOf = (categoryId: string) => categories.find((c) => c.id === categoryId);
  const colorOf = (categoryId: string) => categoryOf(categoryId)?.color ?? theme.colors.iconMuted;

  useEffect(() => {
    let active = true;
    getMonth(accessToken, visibleKey, hiddenParams(hidden))
      .then((month) => {
        if (!active) return;
        const byDay: Record<number, string[]> = {};
        for (const day of month.days) {
          byDay[Number(day.date.slice(-2))] = day.categoryIds.map(colorOf);
        }
        setDots({ key: dotsKey, byDay });
      })
      .catch(() => {
        if (active) setDots({ key: dotsKey, byDay: {} });
      });
    return () => {
      active = false;
    };
    // colorOf changes only with categories, which arrive with the token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, visible.year, visible.month, categories, refresh, hidden]);

  useEffect(() => {
    let active = true;
    listEntries(accessToken, selectedDate)
      .then((list) => {
        if (!active) return;
        setPanelEntries(
          list.entries
            .filter((entry) => entryIsVisible(entry, hidden))
            .map((entry) => ({
            id: entry.id,
            title: decodeContent(entry.content)?.title ?? strings.day.unreadable,
            color: colorOf(entry.categoryId),
            icon: categoryOf(entry.categoryId)?.icon ?? 'tag',
            hasPhotos: (entry.photos?.length ?? 0) > 0,
          })),
        );
      })
      .catch(() => {
        if (active) setPanelEntries([]);
      });
    return () => {
      active = false;
    };
    // refresh is an intentional extra trigger, not a data dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedDate, categories, refresh, hidden]);

  // Functional update: consecutive chevron presses (or a fast swipe after a
  // press) must each move from the latest month, not a stale closure.
  const moveMonth = (delta: number) => {
    setView((prev) => {
      const next = shiftMonth(prev.year, prev.month, delta);
      const isTodayMonth = next.year === todayParts.year && next.month === todayParts.month;
      return { ...next, day: isTodayMonth ? todayParts.day : 1 };
    });
  };

  // Swipe: a three-page pager recentered after each settle, so both
  // directions always have a neighbor to swipe into.
  const { width } = useWindowDimensions();
  const pagerRef = useRef<ScrollView | null>(null);
  const onPagerSettle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (page !== 1) {
      moveMonth(page - 1);
      pagerRef.current?.scrollTo({ x: width, animated: false });
    }
  };

  const weekdayOfSelected = new Date(visible.year, visible.month - 1, selectedDay).getDay();

  return (
    <View style={styles.screen}>
      <View style={styles.navBar}>
        <View>
          <Text style={styles.navTitle}>{strings.month.title(visible.month)}</Text>
          {/* Apple Calendar's zoom-out: the year label is the door to the
              year view, ‹ marking it tappable (ratified 2026-08-20). */}
          {onOpenYear ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={strings.year.open}
              style={styles.navYear}
              hitSlop={{ top: 8, bottom: 12, left: 8, right: 12 }}
              onPress={() => onOpenYear(visible.year, visible.month)}
            >
              <ChevronLeft size={13} color={theme.colors.textSecondary} strokeWidth={2} />
              <Text style={styles.navSubtitle}>{strings.month.yearLabel(visible.year)}</Text>
            </Pressable>
          ) : (
            <Text style={styles.navSubtitle}>{strings.month.yearLabel(visible.year)}</Text>
          )}
        </View>
        {/* Full Apple (ratified 2026-08-20): months change by swipe alone,
            so the nav holds just the lens and the utility. */}
        <View testID="month-nav-actions" style={styles.navActions}>
          {onChangeHidden ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={strings.categories.title}
              style={styles.navButton}
              onPress={() => setSheetOpen(true)}
            >
              <Tags size={20} color={theme.colors.iconDefault} strokeWidth={2} />
            </Pressable>
          ) : null}
          {onOpenSettings ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={strings.settings.open}
              style={styles.navButton}
              onPress={onOpenSettings}
            >
              <Settings size={20} color={theme.colors.iconDefault} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={pagerRef}
        testID="month-pager"
        style={styles.pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: width, y: 0 }}
        onMomentumScrollEnd={onPagerSettle}
      >
        {[-1, 0, 1].map((delta) => {
          const page = shiftMonth(visible.year, visible.month, delta);
          return (
            <View key={delta} style={{ width }} testID={delta === 0 ? 'month-page-current' : undefined}>
              <MonthGrid
                year={page.year}
                month={page.month}
                days={delta === 0 && dots.key === dotsKey ? dots.byDay : {}}
                today={
                  page.year === todayParts.year && page.month === todayParts.month
                    ? todayParts.day
                    : undefined
                }
                selected={delta === 0 ? selectedDay : undefined}
                onSelectDay={(day) => {
                  if (day === selectedDay) {
                    onOpenDay(selectedDate);
                  } else {
                    setView((prev) => ({ ...prev, day }));
                  }
                }}
              />
            </View>
          );
        })}
      </ScrollView>

      {/* Scrolls, so a day with many Entries can clear the floating controls
          rather than sitting under them (#50). */}
      <ScrollView
        style={styles.panelHolder}
        contentContainerStyle={[styles.panelContent, clearance]}
        {...scrollHandlers}
      >
        <DayPanel
          dateLabel={strings.month.dateLabel(visible.month, selectedDay, weekdayOfSelected)}
          entries={panelEntries}
          onOpen={() => onOpenDay(selectedDate)}
        />
      </ScrollView>

      <CalendarFloatingActions
        visible={actionsVisible}
        onToday={() =>
          setView({ year: todayParts.year, month: todayParts.month, day: todayParts.day })
        }
        onAdd={() => onAddEntry(selectedDate)}
      />

      {sheetOpen && onChangeHidden ? (
        <CategorySheet
          accessToken={accessToken}
          categories={categories}
          hidden={hidden}
          onChange={onChangeHidden}
          onCategoriesChanged={() => onCategoriesChanged?.()}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = createStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space6,
    paddingBottom: t.spacing.space4,
  },
  navTitle: {
    ...t.typography.navTitle,
    color: t.colors.textPrimary,
  },
  navSubtitle: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
  },
  navActions: {
    flexDirection: 'row',
    gap: t.spacing.space4,
  },
  pager: {
    flexGrow: 0,
  },
  navButton: {
    width: t.spacing.hitMin,
    height: t.spacing.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHolder: {
    flex: 1,
  },
  panelContent: {
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.panelGap,
  },
  navYear: {
    flexDirection: 'row',
    alignItems: 'center',
  },
}));
