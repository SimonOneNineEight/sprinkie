import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FlatList } from 'react-native';

import { miniMonthHeight } from '../calendar/MiniMonth';
import { monthsInRow, openingRow, ribbonSpan, rowMetrics, rowOfMonth } from '../calendar/ribbon';
import { theme } from '../theme';
import { cat } from '../testing/fixtures';
import { installMockApi, type MockApi } from '../testing/mockApi';
import { YearScreen } from './YearScreen';

const categories = [cat.work, { ...cat.sport, position: 2 }];
const today = new Date(2026, 7, 5);
const span = ribbonSpan(2026);

let api: MockApi;

beforeEach(() => {
  api = installMockApi({
    years: {
      '2026': {
        days: [
          { date: '2026-03-15', categoryId: 'c-sport' },
          { date: '2026-08-02', categoryId: 'c-work' },
        ],
        totalEntries: 3,
      },
      '2025': {
        days: [{ date: '2025-06-09', categoryId: 'c-work' }],
        totalEntries: 1,
      },
    },
  });
});

afterEach(() => {
  api.restore();
  jest.restoreAllMocks();
});

function renderScreen(overrides: Partial<React.ComponentProps<typeof YearScreen>> = {}) {
  return render(
    <YearScreen
      accessToken="tok"
      categories={categories}
      today={today}
      onOpenMonth={jest.fn()}
      onChangeHidden={jest.fn()}
      {...overrides}
    />,
  );
}

const ribbon = () => screen.getByTestId('year-ribbon');

/** Drive the list's viewability callback, which is what scrolling does. */
function scrollTo(rows: number[]) {
  act(() => {
    ribbon().props.onViewableItemsChanged({
      viewableItems: rows.map((index) => ({ index, item: index, key: String(index), isViewable: true })),
    });
  });
}

it('takes its row heights from MiniMonth itself, not a copy of its tokens', () => {
  renderScreen();

  // The precomputation only buys precision if the heights match what
  // MiniMonth actually renders. Rebuilding its geometry from tokens at this
  // call site meant a margin changed there silently shortened every offset
  // here, and a test that re-derived the same numbers could never see it.
  const row = rowOfMonth(span, 2026, 8);
  const metrics = rowMetrics(span, {
    monthHeight: miniMonthHeight,
    gap: theme.spacing.space10,
    yearCaption: theme.typography.meta.lineHeight + theme.spacing.space4,
    topPadding: theme.spacing.space6,
  });
  expect(ribbon().props.getItemLayout(null, row)).toEqual({
    length: metrics.heights[row],
    offset: metrics.offsets[row],
    index: row,
  });
  // And the height genuinely comes from the component: a row is at least as
  // tall as the taller of its two months plus the gap between rows.
  const tallest = Math.max(miniMonthHeight(2026, 7), miniMonthHeight(2026, 8));
  expect(metrics.heights[row]).toBe(tallest + theme.spacing.space10);
});

it('names the year of the TOPMOST visible month, not the bottom one', async () => {
  renderScreen();

  // Several rows visible at once, spanning a year boundary: the header must
  // follow the top of the viewport. Feeding one row at a time let a min/max
  // swap pass unnoticed.
  scrollTo([rowOfMonth(span, 2025, 11), rowOfMonth(span, 2026, 1)]);

  await waitFor(() => expect(screen.getByText('2025年')).toBeTruthy());
  expect(screen.queryByText('2026年')).toBeNull();
});

it('keeps a year whose response lands after a sibling\u2019s', async () => {
  renderScreen();

  // Two years in view, their responses landing in different ticks — the
  // ordinary case, since a screenful is about eight months. A shared
  // cancellation flag used to be invalidated by the first response, so the
  // second was discarded and, with its in-flight marker already cleared,
  // never refetched. The year stayed blank.
  const release2025 = api.holdYears('2025');
  scrollTo([rowOfMonth(span, 2025, 11), rowOfMonth(span, 2026, 1)]);

  // 2025 is topmost, so the header names it. Its count is still unknown while
  // 2026's response lands and re-runs the effect.
  await waitFor(() => expect(screen.getByText('2025年')).toBeTruthy());
  // Wait for 2026's data to PAINT, not merely for its request to be issued:
  // the bug needs 2026's response to have landed and re-run the effect while
  // 2025 is still in the air. August 2026 is in the rendered window.
  await waitFor(() => expect(screen.getByTestId('year-day-8-2')).toBeTruthy());

  release2025();

  // 2025's data must survive and reach the header.
  await waitFor(() => expect(screen.getByText('共 1 則紀錄')).toBeTruthy());
});

it('refetches when an Entry is saved elsewhere', async () => {
  const { rerender } = renderScreen();
  await waitFor(() =>
    expect(api.calls().filter(([u]) => String(u).includes('/years/2026')).length).toBe(1),
  );

  // #51: "changing the hidden-set OR saving an Entry refetches". The route
  // happening to unmount while the form is open hid the absence of this.
  rerender(
    <YearScreen
      accessToken="tok"
      categories={categories}
      today={today}
      onOpenMonth={jest.fn()}
      onChangeHidden={jest.fn()}
      refresh={1}
    />,
  );

  await waitFor(() =>
    expect(api.calls().filter(([u]) => String(u).includes('/years/2026')).length).toBe(2),
  );
});

it('holds no back button and no year chevrons (#27)', () => {
  renderScreen();

  // Dropped when the paging tests went; the rule outlived the pages.
  expect(screen.queryByLabelText('返回')).toBeNull();
  expect(screen.queryByLabelText('上一年')).toBeNull();
  expect(screen.queryByLabelText('下一年')).toBeNull();
  expect(screen.getByLabelText('今天')).toBeTruthy();
  expect(screen.getByLabelText('類別')).toBeTruthy();
});

it('is one continuous ribbon, not twelve months of one year (#51)', () => {
  renderScreen();

  // A fixed-length list of two-month rows spanning ±150 years, so a scroll
  // target is an index rather than a guess.
  expect(ribbon().props.data).toHaveLength(span.rowCount);
  expect(ribbon().props.getItemLayout).toBeDefined();
});

it('opens on today’s month with the recent past above it, not flush to the top', () => {
  renderScreen();

  // Landing the month hard against the top left the whole past behind an
  // upward scroll, which reads backwards for a journal (seen on a device).
  // The list mounts on the month itself; onLayout then scrolls it to centre,
  // because centring needs a viewport height that does not exist before then.
  expect(ribbon().props.initialScrollIndex).toBe(rowOfMonth(span, 2026, 8));
});

it('captions the row January opens, so a year never arrives unannounced', () => {
  renderScreen();

  // The ribbon runs through the boundary by design, which on screen made
  // December and January indistinguishable (#51 follow-up).
  expect(screen.getAllByText('2027年').length).toBeGreaterThan(0);
});

it('runs December straight into January with no break', () => {
  renderScreen();
  const december = rowOfMonth(span, 2026, 12);

  expect(monthsInRow(span, december)).toContainEqual({ year: 2026, month: 12 });
  expect(monthsInRow(span, december + 1)).toContainEqual({ year: 2027, month: 1 });
});

it('shows the colors of a year once it scrolls into view', async () => {
  renderScreen();

  await waitFor(() => expect(screen.getByTestId('year-day-8-2')).toBeTruthy());
  expect(screen.getByTestId('year-day-8-2')).toHaveStyle({ backgroundColor: '#4A93C4' });
});

it('header carries the topmost visible month’s year and that year’s count', async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText('今年到目前為止 3 則紀錄')).toBeTruthy());

  // Scroll until 2025 is topmost: the header follows, count and phrasing both.
  scrollTo([rowOfMonth(span, 2025, 6)]);
  await waitFor(() => expect(screen.getByText('2025年')).toBeTruthy());
  await waitFor(() => expect(screen.getByText('共 1 則紀錄')).toBeTruthy());
});

it('fetches per year as months come into view, and only once each', async () => {
  renderScreen();
  await waitFor(() => expect(api.calls().some(([u]) => String(u).includes('/years/2026'))).toBe(true));

  scrollTo([rowOfMonth(span, 2025, 6)]);
  await waitFor(() => expect(api.calls().some(([u]) => String(u).includes('/years/2025'))).toBe(true));

  // Coming back to a cached year asks nothing again — keyed by year, which is
  // what makes a late response unable to land in the wrong slot (#51).
  const before = api.calls().filter(([u]) => String(u).includes('/years/2026')).length;
  scrollTo([rowOfMonth(span, 2026, 8)]);
  await act(async () => {});
  expect(api.calls().filter(([u]) => String(u).includes('/years/2026')).length).toBe(before);
});

it('今天 scrolls back to today’s month rather than setting a year', async () => {
  const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
  renderScreen();

  fireEvent.press(screen.getByLabelText('今天'));

  expect(scrollToIndex).toHaveBeenCalledWith(
    expect.objectContaining({ index: rowOfMonth(span, 2026, 8) }),
  );
});

it('opens on the month the zoom-out handed over, not that year’s January (#51)', () => {
  renderScreen({ initialFocus: { year: 2025, month: 6 } });

  expect(ribbon().props.initialScrollIndex).toBe(rowOfMonth(span, 2025, 6));
});

it('the wheel scrolls the ribbon to the picked year', async () => {
  const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
  renderScreen();

  fireEvent.press(screen.getByLabelText('選擇年份'));
  fireEvent.press(screen.getByText('2024年'));

  expect(scrollToIndex).toHaveBeenCalledWith(
    expect.objectContaining({ index: rowOfMonth(span, 2024, 1) }),
  );
});

it('opens the tapped month', async () => {
  const onOpenMonth = jest.fn();
  renderScreen({ onOpenMonth });

  fireEvent.press(screen.getAllByLabelText('8月')[0]);

  expect(onOpenMonth).toHaveBeenCalledWith(2026, 8);
});

it('sends the hidden-set to the year endpoint (#30)', async () => {
  renderScreen({ hidden: { categoryIds: ['c-work'], subcategoryIds: [] } });

  await waitFor(() =>
    expect(api.calls().some(([u]) => String(u).includes('hiddenCategories=c-work'))).toBe(true),
  );
});

it('carries no year paging gestures: the surface scrolls vertically now (#51)', () => {
  renderScreen();

  // The flings and their GestureDetector are gone with the pages they turned.
  expect(() => screen.getByTestId('year-fling-next')).toThrow();
  expect(() => screen.getByTestId('year-fling-prev')).toThrow();
});

it('offers no +, having no day to create into (#50)', () => {
  renderScreen();

  expect(screen.queryByLabelText('新增紀錄')).toBeNull();
});
