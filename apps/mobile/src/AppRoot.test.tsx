import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { localDateString } from './calendar/monthMath';
import { encodeContent } from './entries/content';
import { saveDraft } from './entries/drafts';
import { cat } from './testing/fixtures';
import { installMockApi, type MockApi } from './testing/mockApi';
import { ribbonSpan, rowOfMonth } from './calendar/ribbon';
import { AppRoot } from './AppRoot';

type MockSession = { access_token: string; user: { id: string } };
type Listener = (event: string, session: MockSession | null) => void;

const mockAuthState = {
  listeners: [] as Listener[],
  session: null as MockSession | null,
};

jest.mock('./auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: mockAuthState.session } })),
      onAuthStateChange: jest.fn((listener: Listener) => {
        mockAuthState.listeners.push(listener);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      signOut: jest.fn(async () => {
        mockAuthState.session = null;
        mockAuthState.listeners.forEach((listener) => listener('SIGNED_OUT', null));
      }),
    },
  },
}));

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  init: jest.fn(),
  wrap: (component: unknown) => component,
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(),
}));

let api: MockApi;

beforeEach(() => {
  mockAuthState.listeners.length = 0;
  mockAuthState.session = null;
  api = installMockApi();
});

afterEach(() => {
  api.restore();
});

it('shows the sign-in screen when no session exists', async () => {
  render(<AppRoot />);

  expect(await screen.findByText('每天五分鐘，留下你的生活')).toBeTruthy();
  expect(screen.getByText('Sprinkie')).toBeTruthy();
});

it('shows the app and provisions the world when a session exists', async () => {
  mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
  render(<AppRoot />);

  expect(await screen.findByLabelText('新增紀錄')).toBeTruthy();
  const meCall = (globalThis.fetch as jest.Mock).mock.calls.find(([url]) => String(url).endsWith('/me'));
  expect(meCall).toBeTruthy();
  expect(meCall?.[1]?.headers?.Authorization).toBe('Bearer token-1');
  // The resolved App Language rides along as the Starter Category seeding
  // hint (#36); the harness pins it to zh-TW.
  expect(JSON.parse(meCall?.[1]?.body ?? '')).toEqual({ language: 'zh-TW' });
});

it('returns to the sign-in screen on sign-out through settings', async () => {
  mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
  render(<AppRoot />);

  // Sign-out lives in 設定 (#15), behind the month nav's gear.
  fireEvent.press(await screen.findByLabelText('設定'));
  await act(async () => {
    fireEvent.press(await screen.findByText('登出'));
  });

  expect(await screen.findByText('每天五分鐘，留下你的生活')).toBeTruthy();
});

it('gates a deactivated account and restores only on the deliberate tap', async () => {
  mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
  api.restore();
  api = installMockApi({ deactivated: true });

  render(<AppRoot />);
  // A session restore lands on the gate, never silently back in the app.
  expect(await screen.findByText('帳號已停用')).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByText('復原帳號'));
  });
  const reactivateCall = (globalThis.fetch as jest.Mock).mock.calls.find(([u]) =>
    String(u).endsWith('/me/reactivate'),
  );
  expect(reactivateCall).toBeTruthy();
  expect(await screen.findByText(`${new Date().getMonth() + 1}月`)).toBeTruthy();
});

// The zoom-out spans three screens and the routes between them (#40 item 10),
// so it is only true end to end: the month view hands its year over, the
// route carries it, and the year view opens on it. Asserting the two ends
// separately would leave the join untested.
it('zooms out to the month you came from, not the top of a year (#40 item 10, #51)', async () => {
  const now = new Date();
  mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
  render(<AppRoot />);
  await screen.findByLabelText('新增紀錄');

  await act(async () => {
    fireEvent.press(screen.getByLabelText('年'));
  });
  await screen.findByLabelText('選擇年份');

  // The ribbon lands on the exact month the month view was showing. There is
  // no page to land on any more, and no year-level approximation: the row is
  // computed, so this is the precise version of what #40 item 10 asked for.
  const span = ribbonSpan(now.getFullYear());
  expect(screen.getByTestId('year-ribbon').props.initialScrollIndex).toBe(
    rowOfMonth(span, now.getFullYear(), now.getMonth() + 1),
  );
});

// Visibility is a property of the Journal, not of a screen (#41 items 12-14).
// The hidden-set is owned by HomeScreen and every surface reads it, so a hide
// made from the day view reaching the month and year views is only true end
// to end: the sheet changes state one route up, and the other two routes are
// rebuilt from it.
it('hides a Category from the day view, and the other surfaces agree (#41)', async () => {
  const today = new Date();
  const date = localDateString(today);
  mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
  api.restore();
  api = installMockApi({
    me: {
      userId: 'u1',
      journalId: 'j1',
      categories: [cat.work, { ...cat.sport, position: 2 }, cat.gym],
    },
    entries: {
      [date]: [
        { id: 'e1', date, position: 1, categoryId: 'c-sport', subcategoryId: 'c-gym', authorId: 'u1', content: encodeContent({ title: '晨跑', note: '' }) },
        { id: 'e2', date, position: 2, categoryId: 'c-work', authorId: 'u1', content: encodeContent({ title: '寫程式', note: '' }) },
      ],
    },
  });
  render(<AppRoot />);
  await screen.findByLabelText('新增紀錄');

  // Month view → day view: today is already the selected day, so its cell
  // opens rather than reselects.
  expect(await screen.findByText('晨跑')).toBeTruthy();
  await act(async () => {
    fireEvent.press(
      within(screen.getByTestId('month-page-current')).getByTestId(`day-holder-${today.getDate()}`),
    );
  });
  expect(await screen.findByLabelText('返回')).toBeTruthy();
  expect(screen.getByText('運動 · 健身房')).toBeTruthy();

  // Hide 運動 from the day view's own sheet — the family master switch takes
  // 健身房 with it, so the refined Entry goes too.
  fireEvent.press(screen.getByLabelText('類別'));
  await act(async () => {
    fireEvent.press(screen.getByText('運動'));
  });
  fireEvent.press(screen.getByText('完成'));
  expect(screen.queryByText('晨跑')).toBeNull();
  expect(screen.getByText('寫程式')).toBeTruthy();

  // The month view, without a relaunch: its panel drops the Entry and its
  // dots are asked for under the new hidden-set.
  await act(async () => {
    fireEvent.press(screen.getByLabelText('返回'));
  });
  expect(await screen.findByText('寫程式')).toBeTruthy();
  expect(screen.queryByText('晨跑')).toBeNull();
  const monthCalls = () => api.calls().map(([u]) => String(u)).filter((u) => u.includes('/months/'));
  await waitFor(() => {
    expect(monthCalls().at(-1)).toContain('hiddenCategories=c-sport&hiddenSubcategories=c-gym');
  });

  // And the year view, whose filtering is the server's: it has to ask.
  await act(async () => {
    fireEvent.press(screen.getByLabelText('年'));
  });
  await screen.findByLabelText('選擇年份');
  const yearCalls = api.calls().map(([u]) => String(u)).filter((u) => u.includes('/years/'));
  expect(yearCalls.at(-1)).toContain(
    `/years/${today.getFullYear()}?hiddenCategories=c-sport&hiddenSubcategories=c-gym`,
  );
});

it('loads the world once the network returns after an offline launch, so a kept draft reopens prefilled (#100)', async () => {
  // J5.3: relaunched in airplane mode, with a draft kept from the failed save.
  await AsyncStorage.clear();
  api.restore();
  api = installMockApi({ me: { userId: 'u1', journalId: 'j1', categories: [{ ...cat.sport, position: 1 }] } });
  await saveDraft({
    id: 'd-offline',
    date: localDateString(new Date()),
    categoryId: cat.sport.id,
    content: encodeContent({ title: '晨跑', note: '' }),
    photos: [],
    savedAt: new Date().toISOString(),
  });
  const online = globalThis.fetch;
  let offline = true;
  globalThis.fetch = jest.fn((url: unknown, init?: unknown) =>
    offline ? Promise.reject(new TypeError('Network request failed')) : (online as jest.Mock)(url, init),
  ) as unknown as typeof fetch;
  mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
  render(<AppRoot />);
  await screen.findByLabelText('新增紀錄');

  // J5.4: airplane mode off, and the row tapped straight away, before the
  // world has been fetched again.
  offline = false;
  const now = new Date();
  await act(async () => {
    fireEvent.press(
      await screen.findByText(`${now.getMonth() + 1}月${now.getDate()}日 星期${'日一二三四五六'[now.getDay()]}`),
    );
  });
  await act(async () => {
    fireEvent.press(await screen.findByText('晨跑'));
  });

  // The retry lands while the form is open, and the form takes the draft's
  // Category from it rather than staying on an empty list.
  expect(await screen.findByDisplayValue('晨跑', {}, { timeout: 5000 })).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByText('儲存'));
  });
  expect(api.entryPosts()).toHaveLength(1);
  globalThis.fetch = online;
});

it('colors the month dots once /me answers, after a launch whose first /me failed (#100)', async () => {
  // A phone that just woke drops its first request; everything after is online.
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  api.restore();
  api = installMockApi({
    me: { userId: 'u1', journalId: 'j1', categories: [{ ...cat.sport, position: 1 }] },
    monthDays: { [month]: [{ date: `${month}-01`, categoryIds: [cat.sport.id] }] },
  });
  const online = globalThis.fetch;
  let dropped = false;
  globalThis.fetch = jest.fn((url: unknown, init?: unknown) => {
    if (String(url).endsWith('/me') && !dropped) {
      dropped = true;
      return Promise.reject(new TypeError('Network request failed'));
    }
    return (online as jest.Mock)(url, init);
  }) as unknown as typeof fetch;
  mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
  render(<AppRoot />);

  // Until the Categories arrive the dot has no color to wear; after the
  // retry it wears 運動's, rather than staying grey until a relaunch.
  const dot = () =>
    within(within(screen.getByTestId('month-page-current')).getByTestId('day-dots-1')).getByTestId('day-dot');
  await waitFor(() => expect(dot()).toHaveStyle({ backgroundColor: cat.sport.color }), { timeout: 5000 });
  globalThis.fetch = online;
});

it('fills a draft opened before a slow /me answered, once it does (#100)', async () => {
  await AsyncStorage.clear();
  api.restore();
  api = installMockApi({ me: { userId: 'u1', journalId: 'j1', categories: [{ ...cat.sport, position: 1 }] } });
  await saveDraft({
    id: 'd-slow',
    date: localDateString(new Date()),
    categoryId: cat.sport.id,
    content: encodeContent({ title: '晨跑', note: '' }),
    photos: [],
    savedAt: new Date().toISOString(),
  });
  // /me succeeds, but only after the draft's form is already open.
  const online = globalThis.fetch;
  let releaseMe = () => {};
  const meHeld = new Promise<void>((resolve) => (releaseMe = resolve));
  globalThis.fetch = jest.fn((url: unknown, init?: unknown) =>
    String(url).endsWith('/me')
      ? meHeld.then(() => (online as jest.Mock)(url, init))
      : (online as jest.Mock)(url, init),
  ) as unknown as typeof fetch;
  mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
  render(<AppRoot />);
  await screen.findByLabelText('新增紀錄');
  const now = new Date();
  await act(async () => {
    fireEvent.press(
      await screen.findByText(`${now.getMonth() + 1}月${now.getDate()}日 星期${'日一二三四五六'[now.getDay()]}`),
    );
  });
  await act(async () => {
    fireEvent.press(await screen.findByText('晨跑'));
  });

  await act(async () => {
    releaseMe();
  });
  expect(await screen.findByDisplayValue('晨跑')).toBeTruthy();
  globalThis.fetch = online;
});

// The month view returns to the date you left (#113). HomeScreen rebuilt the
// month route bare, so every way back from a day or a form landed on today.
describe('returning to the month view (#113)', () => {
  /** The day panel's label for a date, as the month view prints it. */
  const panelLabel = (d: Date) =>
    `${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`;
  const currentPage = () => within(screen.getByTestId('month-page-current'));

  const signIn = async () => {
    mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
    api.restore();
    api = installMockApi({
      me: { userId: 'u1', journalId: 'j1', categories: [{ ...cat.sport, position: 1 }] },
    });
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');
  };

  it('backs out of a day in an earlier month onto that day, not today', async () => {
    await signIn();
    const now = new Date();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    await act(async () => {
      fireEvent(screen.getByTestId('month-pager'), 'momentumScrollEnd', {
        nativeEvent: { contentOffset: { x: 0 } },
      });
    });
    expect(await screen.findByText(panelLabel(firstOfLastMonth))).toBeTruthy();
    // Select is a no-op on the already-selected 1st; the second tap opens it.
    await act(async () => {
      fireEvent.press(currentPage().getByTestId('day-holder-1'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('返回'));
    });

    expect(await screen.findByText(panelLabel(firstOfLastMonth))).toBeTruthy();
    expect(screen.getByText(`${firstOfLastMonth.getMonth() + 1}月`)).toBeTruthy();
  });

  it('backs out onto the day a swipe moved to, not the day that was opened', async () => {
    await signIn();
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Today is already selected, so its cell opens.
    await act(async () => {
      fireEvent.press(currentPage().getByTestId(`day-holder-${now.getDate()}`));
    });
    await screen.findByLabelText('返回');
    await act(async () => {
      fireGestureHandler(getByGestureTestId('day-fling-next'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]);
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('返回'));
    });

    expect(await screen.findByText(panelLabel(tomorrow))).toBeTruthy();
  });

  /** A day of this month other than today, selected on the month view. */
  const selectOtherDay = async () => {
    const now = new Date();
    const other = new Date(now.getFullYear(), now.getMonth(), now.getDate() === 1 ? 2 : 1);
    await act(async () => {
      fireEvent.press(currentPage().getByTestId(`day-holder-${other.getDate()}`));
    });
    expect(await screen.findByText(panelLabel(other))).toBeTruthy();
    return other;
  };

  it('keeps the day a save was made on, so a second + writes there too', async () => {
    await signIn();
    const other = await selectOtherDay();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('新增紀錄'));
    });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    expect(await screen.findByText(panelLabel(other))).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('新增紀錄'));
    });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '夜跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    // Both posts go to the same day, so make sure the second one happened.
    expect(api.entryPosts()).toHaveLength(2);
    const [, init] = api.entryPosts().at(-1)!;
    expect(JSON.parse(String(init?.body)).date).toBe(localDateString(other));
  });

  it('cancelling the form returns to the day it was opened for', async () => {
    await signIn();
    const other = await selectOtherDay();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('新增紀錄'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('取消'));
    });

    expect(await screen.findByText(panelLabel(other))).toBeTruthy();
  });

  it('lands on the date the Entry was saved onto when the form moved it', async () => {
    await signIn();
    await selectOtherDay();
    const now = new Date();
    // Neither today nor the opened day (the 1st or 2nd), so landing on it
    // can only mean the form's move was followed.
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() === 15 ? 16 : 15);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('新增紀錄'));
    });
    fireEvent.press(screen.getByText('日期'));
    await act(async () => {
      fireEvent.press(within(screen.getByTestId('date-picker-sheet')).getByText(String(target.getDate())));
    });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    expect(await screen.findByText(panelLabel(target))).toBeTruthy();
  });
});
