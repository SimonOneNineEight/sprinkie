import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { encodeContent } from '../entries/content';
import { theme } from '../theme';
import { nothingHidden } from '../calendar/hidden';
import { cat } from '../testing/fixtures';
import { installMockApi, type MockApi } from '../testing/mockApi';
import { MonthScreen } from './MonthScreen';

// The month screen is pinned to a fixed "today" so assertions are stable.
const TODAY = new Date(2026, 7, 17); // 2026-08-17, a Monday

const categories = [cat.work, cat.sport];

let api: MockApi;

beforeEach(() => {
  api = installMockApi();
});

afterEach(() => {
  api.restore();
});

const monthElement = (overrides: Partial<React.ComponentProps<typeof MonthScreen>> = {}) => (
  <MonthScreen
    accessToken="tok"
    categories={categories}
    today={TODAY}
    onOpenDay={jest.fn()}
    onAddEntry={jest.fn()}
    {...overrides}
  />
);

function renderMonth(overrides: Partial<React.ComponentProps<typeof MonthScreen>> = {}) {
  return render(monthElement(overrides));
}

/** Settle the pager one month forward. */
const settleForward = async () => {
  const { width } = Dimensions.get('window');
  await act(async () => {
    fireEvent(screen.getByTestId('month-pager'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 2 * width } },
    });
  });
};

/** What the viewed month is painting on one day. */
const dotsOn = (day: number) =>
  within(
    within(screen.getByTestId('month-page-current')).getByTestId(`day-dots-${day}`),
  ).queryAllByTestId('day-dot');

it('renders the month title and the weekday header', async () => {
  renderMonth();
  expect(await screen.findByText('8月')).toBeTruthy();
  expect(screen.getByText('2026年')).toBeTruthy();
  const page = within(screen.getByTestId('month-page-current'));
  for (const weekday of ['日', '一', '二', '三', '四', '五', '六']) {
    expect(page.getByText(weekday)).toBeTruthy();
  }
});

it('collapses a day with more than four entries into a plain +', async () => {
  api.world.monthDays = {
    '2026-08': [
      {
        date: '2026-08-12',
        categoryIds: ['c-work', 'c-sport', 'c-work', 'c-sport', 'c-work', 'c-sport'],
      },
    ],
  };
  renderMonth();
  expect(await screen.findByTestId('dot-overflow')).toBeTruthy();
});

it("shows today's entries in the panel by default and the empty line otherwise", async () => {
  api.world.entries['2026-08-17'] = [
    {
      id: 'e1',
      date: '2026-08-17',
      position: 1,
      categoryId: 'c-sport',
      authorId: 'u1',
      content: encodeContent({ title: '晨跑', note: '' }),
    },
  ];
  renderMonth();
  expect(await screen.findByText('晨跑')).toBeTruthy();
  expect(screen.getByText('8月17日 星期一')).toBeTruthy();

  await act(async () => {
    fireEvent.press(within(screen.getByTestId('month-page-current')).getByText('20'));
  });
  expect(await screen.findByText('這天沒有紀錄')).toBeTruthy();
  expect(screen.getByText('8月20日 星期四')).toBeTruthy();
});

it('moves between months by swipe alone and fetches the new month', async () => {
  renderMonth();
  await screen.findByText('8月');
  const { width } = Dimensions.get('window');

  await act(async () => {
    fireEvent(screen.getByTestId('month-pager'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 2 * width } },
    });
  });
  expect(await screen.findByText('9月')).toBeTruthy();
  const monthCalls = (globalThis.fetch as jest.Mock).mock.calls
    .map(([url]) => String(url))
    .filter((u) => u.includes('/months/'));
  expect(monthCalls.some((u) => u.includes('/months/2026-09'))).toBe(true);

  await act(async () => {
    fireEvent(screen.getByTestId('month-pager'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0 } },
    });
  });
  await act(async () => {
    fireEvent(screen.getByTestId('month-pager'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0 } },
    });
  });
  expect(await screen.findByText('7月')).toBeTruthy();
});

it('gives the selection the filled circle and today the thin ring (#23)', async () => {
  renderMonth();
  await screen.findByText('8月');
  const page = within(screen.getByTestId('month-page-current'));

  // Selection defaults to today on open: today filled, no ring anywhere.
  expect(page.getByTestId('day-holder-17')).toHaveStyle({
    backgroundColor: theme.colors.surfaceToday,
  });
  expect(page.getByTestId('day-holder-17')).not.toHaveStyle({ borderWidth: 1.5 });

  // Tapping the 3rd moves the filled circle; today keeps only the thin ring.
  // ('3' also exists as September's outside cell; the first match is August.)
  await act(async () => {
    fireEvent.press(page.getAllByText('3')[0]);
  });
  expect(page.getByTestId('day-holder-3')).toHaveStyle({
    backgroundColor: theme.colors.surfaceToday,
  });
  expect(page.getByTestId('day-holder-17')).not.toHaveStyle({
    backgroundColor: theme.colors.surfaceToday,
  });
  expect(page.getByTestId('day-holder-17')).toHaveStyle({ borderWidth: 1.5 });
});

it('opens the day view when the already-selected day is tapped again', async () => {
  const onOpenDay = jest.fn();
  renderMonth({ onOpenDay });
  await screen.findByText('8月');

  // Today (the 17th) starts selected; tapping it again opens the day view.
  await act(async () => {
    fireEvent.press(within(screen.getByTestId('month-page-current')).getByText('17'));
  });
  expect(onOpenDay).toHaveBeenCalledWith('2026-08-17');
});

it('settles a swipe onto the neighboring month', async () => {
  renderMonth();
  await screen.findByText('8月');

  const { width } = Dimensions.get('window');
  await act(async () => {
    fireEvent(screen.getByTestId('month-pager'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 2 * width } },
    });
  });
  expect(await screen.findByText('9月')).toBeTruthy();
});

it('opens the day view from the panel and the form from the +', async () => {
  const onOpenDay = jest.fn();
  const onAddEntry = jest.fn();
  renderMonth({ onOpenDay, onAddEntry });
  await screen.findByText('8月');

  await act(async () => {
    fireEvent.press(screen.getByText('8月17日 星期一'));
  });
  expect(onOpenDay).toHaveBeenCalledWith('2026-08-17');

  fireEvent.press(screen.getByLabelText('新增紀錄'));
  expect(onAddEntry).toHaveBeenCalledWith('2026-08-17');
});

it('creates into the selected day, not blindly into today (#23)', async () => {
  const onAddEntry = jest.fn();
  renderMonth({ onAddEntry });
  await screen.findByText('8月');

  await act(async () => {
    fireEvent.press(within(screen.getByTestId('month-page-current')).getAllByText('3')[0]);
  });
  fireEvent.press(screen.getByLabelText('新增紀錄'));
  expect(onAddEntry).toHaveBeenCalledWith('2026-08-03');
  expect(onAddEntry).not.toHaveBeenCalledWith('2026-08-17');
});

it('opens settings from the nav bar gear', async () => {
  const onOpenSettings = jest.fn();
  renderMonth({ onOpenSettings });
  await screen.findByText('8月');

  fireEvent.press(screen.getByLabelText('設定'));
  expect(onOpenSettings).toHaveBeenCalled();
});

describe('visibility (#30)', () => {
  const withSub = [
    ...categories,
    { id: 'c-gym', name: '健身房', color: '#73B062', icon: 'tag', position: 1, parentId: 'c-sport' },
  ];

  it('opens the 類別 sheet and toggles rows into the hidden-set', async () => {
    const onChangeHidden = jest.fn();
    renderMonth({
      categories: withSub,
      hidden: { categoryIds: [], subcategoryIds: [] },
      onChangeHidden,
    });
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('類別'));
    expect(screen.getByText('類別')).toBeTruthy();
    fireEvent.press(screen.getByText('工作'));
    expect(onChangeHidden).toHaveBeenCalledWith({ categoryIds: ['c-work'], subcategoryIds: [] });

    // A parent with children is the family master switch.
    fireEvent.press(screen.getByText('運動'));
    expect(onChangeHidden).toHaveBeenCalledWith({
      categoryIds: ['c-sport'],
      subcategoryIds: ['c-gym'],
    });

    // Subcategory rows toggle only themselves.
    fireEvent.press(screen.getByText('健身房'));
    expect(onChangeHidden).toHaveBeenCalledWith({ categoryIds: [], subcategoryIds: ['c-gym'] });
  });

  it('sends the hidden-set to the month endpoint', async () => {
    renderMonth({
      categories: withSub,
      hidden: { categoryIds: ['c-work'], subcategoryIds: ['c-gym'] },
      onChangeHidden: jest.fn(),
    });
    await act(async () => {});

    const monthCalls = (globalThis.fetch as jest.Mock).mock.calls
      .map(([u]) => String(u))
      .filter((u) => u.includes('/months/'));
    expect(
      monthCalls.some(
        (u) => u.includes('hiddenCategories=c-work') && u.includes('hiddenSubcategories=c-gym'),
      ),
    ).toBe(true);
  });
});

describe('calendar navigation (#40)', () => {
  it('paints no dots on the month swiped to until that month answers (#40 item 8)', async () => {
    api.world.monthDays = {
      '2026-08': [{ date: '2026-08-12', categoryIds: ['c-work'] }],
      '2026-09': [{ date: '2026-09-03', categoryIds: ['c-sport'] }],
    };
    renderMonth();
    await screen.findByText('8月');
    expect(dotsOn(12)).toHaveLength(1);

    // September's answer is still in flight when the swipe settles: whatever
    // the grid paints now can only have come from August.
    const release = api.holdMonths();
    await settleForward();
    expect(await screen.findByText('9月')).toBeTruthy();
    expect(dotsOn(12)).toHaveLength(0);

    // And once September answers, it fills — blank is the wait, not the end.
    await act(async () => {
      release();
    });
    await waitFor(() => expect(dotsOn(3)).toHaveLength(1));
    expect(dotsOn(12)).toHaveLength(0);
  });

  it('paints no dots while a hidden-set change is in flight (#40 item 8)', async () => {
    api.world.monthDays = { '2026-08': [{ date: '2026-08-12', categoryIds: ['c-work'] }] };
    const view = renderMonth({ hidden: nothingHidden, onChangeHidden: jest.fn() });
    await screen.findByText('8月');
    expect(dotsOn(12)).toHaveLength(1);

    // Hiding refetches the same month, so the month key alone cannot tell the
    // new answer from the old one: what is on screen still says 工作 is shown.
    const release = api.holdMonths();
    await act(async () => {
      view.rerender(
        monthElement({
          hidden: { categoryIds: ['c-work'], subcategoryIds: [] },
          onChangeHidden: jest.fn(),
        }),
      );
    });
    expect(dotsOn(12)).toHaveLength(0);

    await act(async () => {
      release();
    });
  });

  it('hands the viewed month to the year view, not the current one (#40 item 10, #51)', async () => {
    const onOpenYear = jest.fn();
    renderMonth({ onOpenYear });
    await screen.findByText('8月');

    fireEvent.press(screen.getByLabelText('年'));
    expect(onOpenYear).toHaveBeenCalledWith(2026, 8);

    // Five months forward crosses into 2027; ‹年 follows the month you see.
    for (let i = 0; i < 5; i += 1) await settleForward();
    expect(await screen.findByText('1月')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('年'));
    expect(onOpenYear).toHaveBeenLastCalledWith(2027, 1);
  });

  it('returns the month view to now, wherever you have swiped to (#40 item 11)', async () => {
    renderMonth();
    await screen.findByText('8月');
    for (let i = 0; i < 5; i += 1) await settleForward();
    expect(await screen.findByText('1月')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('今天'));
    });
    expect(await screen.findByText('8月')).toBeTruthy();
    expect(screen.getByText('2026年')).toBeTruthy();
    // And today is the selection again, not the 1st of the month.
    expect(
      within(screen.getByTestId('month-page-current')).getByTestId('day-holder-17'),
    ).toHaveStyle({ backgroundColor: theme.colors.surfaceToday });
  });

  it('keeps only tools in the nav bar; 今天 floats at the bottom (#50)', async () => {
    renderMonth({ onOpenSettings: jest.fn(), onChangeHidden: jest.fn() });
    await screen.findByText('8月');

    const nav = within(screen.getByTestId('month-nav-actions'));
    expect(nav.getByLabelText('類別')).toBeTruthy();
    expect(nav.getByLabelText('設定')).toBeTruthy();
    expect(nav.queryByLabelText('今天')).toBeNull();
    // Still reachable, just not from the tool group.
    expect(screen.getByLabelText('今天')).toBeTruthy();
  });
});
