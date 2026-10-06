import { Tags } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category } from '../api/client';
import { getYear } from '../api/client';
import { CalendarFloatingActions, useFloatingActions } from '../calendar/CalendarFloatingActions';
import { CategorySheet } from '../calendar/CategorySheet';
import type { HiddenSet } from '../calendar/hidden';
import { hiddenKey, hiddenParams, nothingHidden } from '../calendar/hidden';
import { MiniMonth, miniMonthHeight } from '../calendar/MiniMonth';
import {
  monthsInRow,
  openingRow,
  ribbonSpan,
  rowMetrics,
  rowOfMonth,
  SPAN_YEARS,
  startsYear,
} from '../calendar/ribbon';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

type Props = {
  accessToken: string;
  categories: Category[];
  /** Injectable for tests; defaults to the device's now. */
  today?: Date;
  /** Open on this month rather than today's — the month view's zoom-out hands
   * over the month it was showing (#40, sharpened by #51). */
  initialFocus?: { year: number; month: number };
  /** The persistent hidden-set (#30), owned by HomeScreen. */
  hidden?: HiddenSet;
  onChangeHidden?: (hidden: HiddenSet) => void;
  /** Fired after the 類別 sheet changes a category, so /me refetches. */
  onCategoriesChanged?: () => void;
  /** Bump to refetch every visible year (after a save elsewhere), the shape
   * MonthScreen already uses. #51 asks for a saved Entry to refetch, and the
   * route unmounting while the form is open only hid the absence. */
  refresh?: number;
  onOpenMonth: (year: number, month: number) => void;
};

// The year wheel (#27): ±150 years around the viewed year. Fixed row height so
// the list can start centered.
const WHEEL_ROW_HEIGHT = 44;

// Hoisted: React Native does not support viewabilityConfig changing identity
// between renders, and this surface re-renders on every scroll as the header
// follows the topmost month.
const VIEWABILITY = { itemVisiblePercentThreshold: 10 };

// Read by both the row style and the row measurements. Declared once because
// they must agree: a gap changed in one place and not the other shortens every
// scroll offset by that much per row, silently.
const ROW_GAP = theme.spacing.space10;
const YEAR_CAPTION = theme.typography.meta.lineHeight + theme.spacing.space4;
const TOP_PADDING = theme.spacing.space6;

/** A year's days keyed by month, plus the year's own total. */
type YearData = { colors: Record<number, Record<number, string>>; total: number };

// The year view (#51): one vertical ribbon of mini months running continuously
// through the years, opening on today's month. It replaces twelve mini months
// paged a year at a time — a year stopped being something you could see whole
// the moment #50's floating controls needed clearance and the grid became a
// ScrollView, so this makes scrolling the point rather than a consolation.
//
// The header is now the only thing that says which year you are in, since the
// ribbon itself never announces a boundary: December simply runs into January.
export function YearScreen({
  accessToken,
  categories,
  today = new Date(),
  initialFocus,
  hidden = nothingHidden,
  onChangeHidden,
  onCategoriesChanged,
  refresh = 0,
  onOpenMonth,
}: Props) {
  const strings = useStrings();
  const listRef = useRef<FlatList<number>>(null);
  const thisYear = today.getFullYear();
  const focus = initialFocus ?? { year: thisYear, month: today.getMonth() + 1 };

  const span = useMemo(() => ribbonSpan(thisYear), [thisYear]);
  const metrics = useMemo(
    () =>
      rowMetrics(span, {
        monthHeight: miniMonthHeight,
        gap: ROW_GAP,
        yearCaption: YEAR_CAPTION,
        topPadding: TOP_PADDING,
      }),
    [span],
  );
  const rows = useMemo(
    () => Array.from({ length: span.rowCount }, (_, i) => i),
    [span.rowCount],
  );

  const [headerYear, setHeaderYear] = useState(focus.year);
  const [visibleYears, setVisibleYears] = useState<number[]>([focus.year]);
  // The cache carries the hidden-set and categories it answers, the shape
  // MonthScreen's dots already use (#40 item 8). Hiding a Category or
  // recoloring one changes every year at once, so a stale key reads as empty
  // rather than being cleared from an effect.
  const cacheKey = `${hiddenKey(hidden)}|${categories.map((c) => `${c.id}${c.color}`).join(',')}|${refresh}`;
  // Keyed "<cacheKey>|<year>", not {key, byYear}. A response that lands after
  // the hidden-set changed writes into its own slot and is simply never read,
  // so no request needs cancelling — and an effect re-run cannot invalidate a
  // sibling request that is still in the air, which is what dropped a year
  // whenever two were on screen at once.
  const [slots, setSlots] = useState<Record<string, YearData>>({});
  const yearsForKey = useMemo(() => {
    const byYear: Record<number, YearData> = {};
    const prefix = `${cacheKey}|`;
    for (const [slot, data] of Object.entries(slots)) {
      if (slot.startsWith(prefix)) byYear[Number(slot.slice(prefix.length))] = data;
    }
    return byYear;
  }, [slots, cacheKey]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const { visible: actionsVisible, scrollHandlers, clearance } = useFloatingActions();
  // The wheel drops in under the nav bar, which stopped being a fixed height
  // when the count became a second line (#50). The initial value is that
  // layout derived from its own tokens rather than the stale navBarHeight,
  // and onLayout corrects it if anything wraps.
  const [navHeight, setNavHeight] = useState(
    theme.spacing.space6 +
      theme.typography.navTitle.lineHeight +
      theme.typography.meta.lineHeight +
      theme.spacing.space4,
  );

  // Fetching stays per-year and keyed by year, which is what makes the
  // dot-ghosting class (#40) impossible here: a late response can only land in
  // its own year's slot, never in the one you have scrolled to since.
  const inFlight = useRef(new Map<number, string>());
  useEffect(() => {
    for (const year of visibleYears) {
      if (yearsForKey[year] || inFlight.current.get(year) === cacheKey) continue;
      const requestKey = cacheKey;
      inFlight.current.set(year, requestKey);
      getYear(accessToken, String(year), hiddenParams(hidden))
        .then((data) => {
          // Only clear the marker this request owns: a newer key's request for
          // the same year must keep its own.
          if (inFlight.current.get(year) === requestKey) inFlight.current.delete(year);
          const colors: Record<number, Record<number, string>> = {};
          for (const day of data.days) {
            const month = Number(day.date.slice(5, 7));
            const dayNumber = Number(day.date.slice(8, 10));
            const color = categories.find((c) => c.id === day.categoryId)?.color;
            if (!color) continue;
            (colors[month] ??= {})[dayNumber] = color;
          }
          setSlots((current) => ({
            ...current,
            [`${requestKey}|${year}`]: { colors, total: data.totalEntries },
          }));
        })
        .catch(() => {
          if (inFlight.current.get(year) === requestKey) inFlight.current.delete(year);
        });
    }
  }, [accessToken, categories, hidden, visibleYears, yearsForKey, cacheKey]);

  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visibleRows = viewableItems
        .map((item) => item.index)
        .filter((index): index is number => index !== null);
      if (visibleRows.length === 0) return;
      const years = new Set<number>();
      for (const row of visibleRows) {
        for (const { year } of monthsInRow(span, row)) years.add(year);
      }
      // The topmost visible month names the year, so scrolling into 2022
      // reads 2022 with 2022's total.
      setHeaderYear(monthsInRow(span, Math.min(...visibleRows))[0].year);
      setVisibleYears((current) => {
        const next = [...years].sort();
        return next.length === current.length && next.every((y, i) => y === current[i])
          ? current
          : next;
      });
    },
    [span],
  );

  const scrollToMonth = useCallback(
    (year: number, month: number) => {
      listRef.current?.scrollToIndex({ index: rowOfMonth(span, year, month), animated: true });
    },
    [span],
  );

  const total = yearsForKey[headerYear]?.total ?? 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* The floats position against this View, not the SafeAreaView: an
          absolute child ignores its parent's safe-area padding. */}
      <View style={styles.fill}>
        <View
          style={styles.navBar}
          onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}
        >
          {/* No back and no chevrons (ratified 2026-09-10). The year and its
              count track the topmost visible month rather than naming a page,
              because the ribbon has no pages (#51). */}
          <View testID="year-header" style={styles.navTitleBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={strings.year.pickYear}
              onPress={() => setWheelOpen(true)}
            >
              <Text style={styles.navTitle}>{strings.year.title(headerYear)}</Text>
            </Pressable>
            <Text style={styles.navSubtitle}>
              {headerYear === thisYear
                ? strings.year.countLabel(total)
                : strings.year.totalLabel(total)}
            </Text>
          </View>
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
        </View>
        <FlatList
          ref={listRef}
          testID="year-ribbon"
          style={styles.scroll}
          contentContainerStyle={[styles.body, clearance]}
          data={rows}
          keyExtractor={(row) => String(row)}
          initialScrollIndex={openingRow(span, focus.year, focus.month)}
          getItemLayout={(_, index) => ({
            length: metrics.heights[index],
            offset: metrics.offsets[index],
            index,
          })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={VIEWABILITY}
          showsVerticalScrollIndicator={false}
          {...scrollHandlers}
          renderItem={({ item: row }) => (
            <View>
              {/* The ribbon runs through the boundary, so January says which
                  year it is rather than arriving unannounced (#51 follow-up,
                  from looking at it on a device). */}
              {startsYear(row) ? (
                <Text style={styles.yearCaption}>
                  {strings.year.title(monthsInRow(span, row)[0].year)}
                </Text>
              ) : null}
              <View style={styles.row}>
              {monthsInRow(span, row).map(({ year, month }) => (
                <View key={`${year}-${month}`} style={styles.rowItem}>
                  <MiniMonth
                    year={year}
                    month={month}
                    colors={yearsForKey[year]?.colors[month] ?? {}}
                    todayDay={
                      year === thisYear && month === today.getMonth() + 1
                        ? today.getDate()
                        : undefined
                    }
                    onPress={() => onOpenMonth(year, month)}
                  />
                </View>
              ))}
              </View>
            </View>
          )}
        />
        <CalendarFloatingActions
          visible={actionsVisible}
          onToday={() => scrollToMonth(thisYear, today.getMonth() + 1)}
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
        {wheelOpen ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={strings.entryForm.cancel}
              feedback="none"
              style={styles.wheelScrim}
              onPress={() => setWheelOpen(false)}
            />
            <View style={[styles.wheelCard, { top: navHeight }]}>
              <FlatList
                testID="year-wheel"
                // The span, not headerYear ± SPAN: the wheel is anchored to
                // today like the ribbon is, so it can never offer a year the
                // ribbon has no row for.
                data={Array.from({ length: SPAN_YEARS * 2 + 1 }, (_, i) => span.baseYear + i)}
                keyExtractor={(item) => String(item)}
                getItemLayout={(_, index) => ({
                  length: WHEEL_ROW_HEIGHT,
                  offset: WHEEL_ROW_HEIGHT * index,
                  index,
                })}
                // Two rows above the viewed year: it sits centered in the
                // five-row window.
                initialScrollIndex={Math.max(0, headerYear - span.baseYear - 2)}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.wheelRow}
                    onPress={() => {
                      // The wheel stays how you travel decades, and matters
                      // more now that paging is gone: it scrolls the ribbon
                      // to that year's January rather than swapping a page.
                      scrollToMonth(item, 1);
                      setWheelOpen(false);
                    }}
                  >
                    <Text style={item === headerYear ? styles.wheelYearCurrent : styles.wheelYear}>
                      {strings.year.title(item)}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = createStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.surface,
  },
  fill: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: t.spacing.space4,
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space6,
    paddingBottom: t.spacing.space4,
  },
  navTitleBlock: {
    flex: 1,
  },
  navButton: {
    width: t.spacing.hitMin,
    height: t.spacing.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    ...t.typography.navTitle,
    color: t.colors.textPrimary,
  },
  navSubtitle: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
  },
  wheelScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.scrim,
  },
  // The wheel drops in behind the title: a floating card under the nav bar.
  wheelCard: {
    position: 'absolute',
    left: t.spacing.screenGutter,
    // Wide enough for a four-digit 年 row plus card padding; not a token.
    width: 132,
    height: WHEEL_ROW_HEIGHT * 5,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    borderWidth: t.border.hairline,
    borderColor: t.colors.lineSeparator,
    overflow: 'hidden',
  },
  wheelRow: {
    height: WHEEL_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: t.spacing.cardPadding,
  },
  wheelYear: {
    ...t.typography.entryTitle,
    color: t.colors.textSecondary,
  },
  wheelYearCurrent: {
    ...t.typography.entryTitle,
    fontWeight: '600',
    color: t.colors.textPrimary,
  },
  // The bar is a sibling below, so the scroller has to claim its space
  // rather than size to its content and push the bar off the screen.
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: TOP_PADDING,
  },
  // Two up, breathing (#51): the old grid packed twelve months into one
  // screen because it had to. Nothing has to now, so the columns narrow and
  // the rows open up, which lands roughly eight months in view instead of
  // twelve. The mini months stay large enough that one recorded day reads.
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: ROW_GAP,
  },
  rowItem: {
    width: '44%',
  },
  yearCaption: {
    ...t.typography.meta,
    fontWeight: '600',
    color: t.colors.textTertiary,
    marginBottom: t.spacing.space4,
  },
  // paddingTop is TOP_PADDING: the measurements start there, since offsets are
  // taken from the top of the content view which this padding shifts.
}));
