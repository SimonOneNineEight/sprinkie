// The Entry view's photo tap opens the viewer (#119), which holds its own
// gesture root and SafeAreaProvider inside its Modal: the gesture library's
// setup and the safe-area mock let both render in jest, as in
// PhotoViewer.test.tsx.
import 'react-native-gesture-handler/jestSetup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, AppState, Linking } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { localDateString } from './calendar/monthMath';
import { encodeContent } from './entries/content';
import { AppLanguageProvider } from './i18n/AppLanguageProvider';
import { processPhoto } from './photos/processPhoto';
import { saveDraft } from './entries/drafts';
import { lineFadeMs, pointerFadeMs } from './reminder/ReminderInvite';
import { fakeNotifications } from './testing/fakeNotifications';
import { cat } from './testing/fixtures';
import { isHollowRow } from './testing/isHollowRow';
import { installMockApi, type MockApi, type MockEntry } from './testing/mockApi';
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
      // 設定's 連結帳戶 (#20) reads the account's sign-in methods on open.
      getUserIdentities: jest.fn(async () => ({ data: { identities: [] }, error: null })),
      // Confirm email off: a sign-up comes back signed in.
      signUp: jest.fn(async () => {
        const session = { access_token: 'token-new', user: { id: 'u-new' } };
        mockAuthState.session = session;
        mockAuthState.listeners.forEach((listener) => listener('SIGNED_IN', session));
        return { data: { session, user: { identities: [{}] } }, error: null };
      }),
    },
  },
}));

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// The Entry view's half-saved edit (#119) attaches a photo in the form.
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));
jest.mock('./photos/processPhoto', () => ({ processPhoto: jest.fn() }));

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
  jest.useRealTimers();
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

// SI.9: with Confirm email off, a sign-up opens the app at once.
it('opens the app straight after an email sign-up that comes back signed in', async () => {
  render(<AppRoot />);
  fireEvent.press(await screen.findByText('使用電子郵件登入'));
  fireEvent.press(screen.getByText('還沒有帳戶？註冊'));
  fireEvent.changeText(screen.getByPlaceholderText('電子郵件'), 'new@wlog.local');
  fireEvent.changeText(screen.getByPlaceholderText('密碼'), 'secret-123');

  await act(async () => {
    fireEvent.press(screen.getByText('建立帳戶'));
  });

  expect(await screen.findByLabelText('新增紀錄')).toBeTruthy();
  expect(screen.queryByText('確認電子郵件')).toBeNull();
});

// A verified reset code signs the client in before the new password is set
// (#21): the app waits for the password, or 設定新密碼 would vanish under it.
it('stays on sign-in through a password reset until the new password is saved', async () => {
  render(<AppRoot />);
  expect(await screen.findByText('每天五分鐘，留下你的生活')).toBeTruthy();

  const session = { access_token: 'token-1', user: { id: 'u1' } };
  act(() => mockAuthState.listeners.forEach((listener) => listener('PASSWORD_RECOVERY', session)));
  expect(screen.getByText('每天五分鐘，留下你的生活')).toBeTruthy();
  expect(screen.queryByLabelText('新增紀錄')).toBeNull();

  act(() => mockAuthState.listeners.forEach((listener) => listener('USER_UPDATED', session)));
  expect(await screen.findByLabelText('新增紀錄')).toBeTruthy();
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

/** Opens the 類別 sheet from the screen showing, taps each name, closes it. */
const choose = async (...names: string[]) => {
  fireEvent.press(screen.getByLabelText(/^類別/));
  for (const name of names) {
    await act(async () => {
      // Within the sheet: the day view's cards carry Category names too.
      fireEvent.press(within(screen.getByTestId('category-sheet')).getByText(name));
    });
  }
  fireEvent.press(screen.getByText('完成'));
};

// Visibility is a property of the Journal, not of a screen (#41 items 12-14).
// The Filter is owned by HomeScreen and every surface reads it, so a choice
// made from the day view reaching the month and year views is only true end
// to end: the sheet changes state one route up, and the other two routes are
// rebuilt from it.
it('chooses a Category from the day view, and the other surfaces agree (#41)', async () => {
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

  // Choose 工作 from the day view's own sheet: 運動 and its 健身房 fall
  // outside the Filter, so the refined Entry goes.
  await choose('工作');
  expect(screen.queryByText('晨跑')).toBeNull();
  expect(screen.getByText('寫程式')).toBeTruthy();

  // The month view, without a relaunch: its panel drops the Entry and its
  // dots are asked for under the Filter's complement.
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
  // The failed /me retries on a 2s timer, which the test moves on by hand.
  jest.useFakeTimers();
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
  await act(() => jest.advanceTimersByTimeAsync(2000));
  expect(await screen.findByDisplayValue('晨跑')).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByText('儲存'));
  });
  expect(api.entryPosts()).toHaveLength(1);
  globalThis.fetch = online;
});

it('colors the month dots once /me answers, after a launch whose first /me failed (#100)', async () => {
  // The failed /me retries on a 2s timer, which the test moves on by hand.
  jest.useFakeTimers();
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
  await screen.findByLabelText('新增紀錄');
  await act(() => jest.advanceTimersByTimeAsync(2000));
  await waitFor(() => expect(dot()).toHaveStyle({ backgroundColor: cat.sport.color }));
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

// The Entry view (#119): a card opens the Entry to read, and 編輯 on it opens
// the form. Where each way out of the form lands spans DayScreen and
// HomeScreen's routes, so these run end to end.
describe('the Entry view (#119)', () => {
  const today = new Date();
  const date = localDateString(today);
  /** A date as the month panel and the Entry view print it. */
  const panelLabel = (d: Date) =>
    `${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`;
  const entry = (id: string, position: number, categoryId: string, title: string, extra: object = {}) => ({
    id, date, position, categoryId, authorId: 'u1', content: encodeContent({ title, note: '' }), ...extra,
  });

  /** Signs in on a world whose today holds the given Entries, and opens today's day view. */
  const openToday = async (entries: ReturnType<typeof entry>[]) => {
    mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
    api.restore();
    api = installMockApi({
      me: {
        userId: 'u1',
        journalId: 'j1',
        categories: [cat.work, { ...cat.sport, position: 2 }, { ...cat.food, position: 3 }, cat.gym],
      },
      entries: { [date]: entries },
    });
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');
    // Today is already selected, so its cell opens.
    await act(async () => {
      fireEvent.press(
        within(screen.getByTestId('month-page-current')).getByTestId(`day-holder-${today.getDate()}`),
      );
    });
    await screen.findByLabelText('返回');
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('opens from a card, while a Draft row still opens the form', async () => {
    await saveDraft({
      id: 'd1',
      date,
      categoryId: cat.food.id,
      content: encodeContent({ title: '沒存到的午餐', note: '' }),
      photos: [],
      savedAt: new Date().toISOString(),
    });
    await openToday([entry('e1', 1, 'c-sport', '晨跑')]);

    await act(async () => {
      fireEvent.press(await screen.findByText('晨跑'));
    });
    expect(screen.getByText('編輯')).toBeTruthy();
    expect(screen.queryByPlaceholderText('標題')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('返回'));
    });
    await act(async () => {
      fireEvent.press(await screen.findByText('沒存到的午餐'));
    });
    expect(await screen.findByDisplayValue('沒存到的午餐')).toBeTruthy();
    expect(screen.queryByText('編輯')).toBeNull();
  });

  const threePhotos = [0, 1, 2].map((i) => ({
    id: `p${i}`,
    position: i + 1,
    url: `https://signed/full${i}`,
    thumbUrl: `https://signed/thumb${i}`,
  }));

  /** Opens the card titled `title` into the Entry view. */
  const openCard = async (title: string) => {
    await act(async () => {
      fireEvent.press(await screen.findByText(title));
    });
    await screen.findByText('編輯');
  };

  it('shows the Category chip, title, date, the whole note and the photos', async () => {
    const note = '天氣很好，河濱的風很涼，跑完在橋下拉筋，看到很多人在遛狗。';
    await openToday([
      entry('e1', 1, 'c-sport', '晨跑', {
        subcategoryId: 'c-gym',
        content: encodeContent({ title: '晨跑', note }),
        photos: threePhotos,
      }),
    ]);
    await openCard('晨跑');

    expect(screen.getByText('運動 · 健身房')).toBeTruthy();
    expect(screen.getByText('晨跑')).toBeTruthy();
    expect(screen.getByText(panelLabel(today))).toBeTruthy();
    // The whole note: the card's five-line limit does not carry over.
    expect(screen.getByText(note).props.numberOfLines).toBeUndefined();
    expect(threePhotos.map((p) => screen.getByTestId(`entry-photo-${p.id}`).props.source)).toEqual(
      threePhotos.map((p) => ({ uri: p.thumbUrl })),
    );
  });

  /** 編輯 on the Entry view, then the form's 儲存 with a new title. */
  const editTitle = async (title: string) => {
    await act(async () => {
      fireEvent.press(screen.getByText('編輯'));
    });
    fireEvent.changeText(screen.getByPlaceholderText('標題'), title);
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
  };

  it('returns to the Entry view after 編輯 → 儲存, showing what was saved', async () => {
    await openToday([entry('e1', 1, 'c-sport', '晨跑')]);
    await openCard('晨跑');

    await editTitle('夜跑');

    expect(await screen.findByText('夜跑')).toBeTruthy();
    expect(screen.getByText('編輯')).toBeTruthy();
    expect(screen.queryByPlaceholderText('標題')).toBeNull();
  });

  it('follows an Entry the form moved to another date, and backs out to that day', async () => {
    // Another day of this month, so the form's picker opens on it.
    const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() === 15 ? 16 : 15);
    await openToday([entry('e1', 1, 'c-sport', '晨跑')]);
    await openCard('晨跑');

    await act(async () => {
      fireEvent.press(screen.getByText('編輯'));
    });
    fireEvent.press(screen.getByText('日期'));
    await act(async () => {
      fireEvent.press(within(screen.getByTestId('date-picker-sheet')).getByText(String(target.getDate())));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    // The Entry view, on the Entry's new date.
    expect(await screen.findByText(panelLabel(target))).toBeTruthy();
    expect(screen.getByText('編輯')).toBeTruthy();
    expect(screen.getByText('晨跑')).toBeTruthy();

    // Back: the new date's day view, where the Entry lives now.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('返回'));
    });
    expect(screen.queryByText('編輯')).toBeNull();
    expect(screen.getByText(panelLabel(target))).toBeTruthy();
    expect(screen.getByText('晨跑')).toBeTruthy();
  });

  it('returns to the Entry view unchanged on 取消, and to the day view on 刪除紀錄', async () => {
    await openToday([entry('e1', 1, 'c-sport', '晨跑'), entry('e2', 2, 'c-food', '午餐')]);
    await openCard('晨跑');

    await act(async () => {
      fireEvent.press(screen.getByText('編輯'));
    });
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '夜跑');
    await act(async () => {
      fireEvent.press(screen.getByText('取消'));
    });
    expect(screen.getByText('編輯')).toBeTruthy();
    expect(screen.getByText('晨跑')).toBeTruthy();
    expect(screen.queryByText('夜跑')).toBeNull();

    const alertSpy = jest.spyOn(Alert, 'alert');
    await act(async () => {
      fireEvent.press(screen.getByText('編輯'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('刪除紀錄'));
    });
    const destructive = (alertSpy.mock.calls[0][2] ?? []).find((b) => b.style === 'destructive');
    await act(async () => {
      destructive?.onPress?.();
    });
    alertSpy.mockRestore();

    // The day view, with the deleted Entry gone and the other still there.
    expect(await screen.findByText('午餐')).toBeTruthy();
    expect(screen.queryByText('編輯')).toBeNull();
    expect(screen.queryByText('晨跑')).toBeNull();
  });

  const fling = async (direction: 'next' | 'prev') => {
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`entry-fling-${direction}`), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]);
    });
  };

  it("swipes through the day's visible Entries in order, stopping at either end", async () => {
    // 寫程式 sits between the two and is outside the Filter, so the day view
    // skips it and so does the swipe (ADR 0009: the day view is the surface).
    await openToday([
      entry('e1', 1, 'c-sport', '晨跑'),
      entry('e2', 2, 'c-work', '寫程式'),
      entry('e3', 3, 'c-food', '午餐'),
    ]);
    await choose('運動', '美食');
    await openCard('晨跑');
    expect(screen.getByText('1 / 2')).toBeTruthy();

    await fling('prev');
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('晨跑')).toBeTruthy();

    await fling('next');
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByText('午餐')).toBeTruthy();
    expect(screen.queryByText('寫程式')).toBeNull();

    await fling('next');
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByText('午餐')).toBeTruthy();

    await fling('prev');
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('晨跑')).toBeTruthy();
  });

  it('opens the photo viewer on the photo tapped', async () => {
    await openToday([entry('e1', 1, 'c-sport', '晨跑', { photos: threePhotos })]);
    await openCard('晨跑');

    await act(async () => {
      fireEvent.press(screen.getByTestId('entry-photo-p1'));
    });

    expect(screen.getByLabelText('關閉')).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();
    // The original, with the thumbnail the view showed beneath it.
    const pager = screen.getByTestId('photo-viewer-pager');
    expect(pager.props.data[pager.props.initialScrollIndex]).toMatchObject({
      uri: 'https://signed/full1',
      thumbUri: 'https://signed/thumb1',
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('關閉'));
    });
    expect(screen.queryByTestId('photo-viewer-pager')).toBeNull();
    expect(screen.getByText('編輯')).toBeTruthy();
  });

  /** From the open Entry view: 編輯, move the Entry to 工作 (outside the Filter), 儲存. */
  const editOutOfFilter = async () => {
    await act(async () => {
      fireEvent.press(screen.getByText('編輯'));
    });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.press(screen.getByText('工作'));
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
  };

  it('stays on the day view once the viewed Entry leaves the Filter, even when it comes back', async () => {
    await openToday([entry('e1', 1, 'c-sport', '晨跑'), entry('e2', 2, 'c-food', '午餐')]);
    await choose('運動', '美食');
    await openCard('晨跑');

    await editOutOfFilter();
    expect(await screen.findByText('午餐')).toBeTruthy();
    expect(screen.queryByText('編輯')).toBeNull();

    // Choosing 工作 too brings the card back, not the Entry view.
    fireEvent.press(screen.getByLabelText(/^類別/));
    await act(async () => {
      fireEvent.press(screen.getByText('工作'));
    });
    expect(screen.queryByText('編輯')).toBeNull();
    fireEvent.press(screen.getByText('完成'));
    expect(screen.getByText('晨跑')).toBeTruthy();
  });

  it("does not follow a new Entry the day view's + saved onto another date", async () => {
    const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() === 15 ? 16 : 15);
    await openToday([entry('e1', 1, 'c-sport', '晨跑'), entry('e2', 2, 'c-food', '午餐')]);
    await choose('運動', '美食');
    await openCard('晨跑');
    // Back on the day view the way the view lets go of an Entry it can no
    // longer show, rather than by ‹.
    await editOutOfFilter();
    await screen.findByText('午餐');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('新增紀錄'));
    });
    fireEvent.press(screen.getByText('日期'));
    await act(async () => {
      fireEvent.press(within(screen.getByTestId('date-picker-sheet')).getByText(String(target.getDate())));
    });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '夜跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    // Still today's day view: a new Entry is not one the view was showing.
    expect(await screen.findByText('午餐')).toBeTruthy();
    expect(screen.getByText(panelLabel(today))).toBeTruthy();
  });

  it('shows what a half-finished save already wrote when the form is cancelled', async () => {
    const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() === 15 ? 16 : 15);
    await openToday([entry('e1', 1, 'c-sport', '晨跑')]);
    await openCard('晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('編輯'));
    });
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '夜跑');
    fireEvent.press(screen.getByText('日期'));
    await act(async () => {
      fireEvent.press(within(screen.getByTestId('date-picker-sheet')).getByText(String(target.getDate())));
    });
    jest.mocked(processPhoto).mockResolvedValue({ fullUri: 'file:///a.jpg', thumbUri: 'file:///a_t.jpg' });
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///IMG_1.HEIC', width: 4032, height: 3024 }],
    } as ImagePicker.ImagePickerResult);
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, choose) => choose(1));
    await act(async () => {
      fireEvent.press(screen.getByTestId('grid-item-__add__'));
    });
    sheet.mockRestore();

    // The words and the new date land; the photo upload does not.
    api.failures.presign = true;
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    expect(screen.getByText('照片上傳失敗，請再試一次')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('取消'));
    });

    // The view shows the Entry as the server now holds it.
    expect(await screen.findByText('夜跑')).toBeTruthy();
    expect(screen.getByText(panelLabel(target))).toBeTruthy();
    expect(screen.getByText('編輯')).toBeTruthy();
  });

  it("never shows the Entry from the day it left while its new day's list is on its way", async () => {
    const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() === 15 ? 16 : 15);
    await openToday([entry('e1', 1, 'c-sport', '晨跑'), entry('e2', 2, 'c-food', '午餐')]);
    await openCard('晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('編輯'));
    });
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '夜跑');
    fireEvent.press(screen.getByText('日期'));
    await act(async () => {
      fireEvent.press(within(screen.getByTestId('date-picker-sheet')).getByText(String(target.getDate())));
    });

    const release = api.holdEntries(localDateString(target));
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    // Today's list answers today, not the new date: nothing from it shows.
    expect(screen.queryByText('晨跑')).toBeNull();
    expect(screen.queryByText('1 / 2')).toBeNull();

    await act(async () => {
      release();
    });
    expect(await screen.findByText('夜跑')).toBeTruthy();
    expect(screen.getByText('1 / 1')).toBeTruthy();
  });
});

// The manual pass's cases that need no device (#109), where the state they
// are about lives above any one screen.
describe('the manual pass, without a device (#109)', () => {
  const today = new Date();
  const date = localDateString(today);
  const entry = (id: string, position: number, categoryId: string, title: string) => ({
    id, date, position, categoryId, authorId: 'u1', content: encodeContent({ title, note: '' }),
  });

  /** Signs in on a world whose today holds 寫程式 (工作) and 晨跑 (運動), on the month view. */
  const signIn = async (tree: React.ReactElement = <AppRoot />) => {
    mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
    api.restore();
    api = installMockApi({
      me: {
        userId: 'u1',
        journalId: 'j1',
        categories: [
          { ...cat.work, inUse: true, hasChildren: false },
          { ...cat.sport, inUse: true, hasChildren: false },
          { ...cat.food, inUse: false, hasChildren: false },
        ],
      },
      entries: { [date]: [entry('e1', 1, 'c-work', '寫程式'), entry('e2', 2, 'c-sport', '晨跑')] },
      monthDays: { [date.slice(0, 7)]: [{ date, categoryIds: ['c-work', 'c-sport'] }] },
      years: { [date.slice(0, 4)]: { days: [{ date, categoryId: 'c-work' }], totalEntries: 2 } },
    });
    render(tree);
    expect(await screen.findByText('寫程式')).toBeTruthy();
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    // The language override persists, and #30's hidden-set did; neither may leak.
    await AsyncStorage.clear();
  });

  // CS.13
  it('reopens the 類別 sheet with the Filter it was closed with', async () => {
    await signIn();

    await choose('運動');

    fireEvent.press(screen.getByLabelText(/^類別/));
    expect(isHollowRow('運動')).toBe(false);
    expect(isHollowRow('工作')).toBe(true);
    expect(isHollowRow('美食')).toBe(true);
    expect(screen.getByRole('button', { name: '全部', selected: false })).toBeTruthy();
  });

  it('says on the 類別 button that a Filter is on, on the month and year views (#134)', async () => {
    await signIn();
    expect(screen.getByLabelText('類別')).toBeTruthy();

    await choose('運動');
    expect(screen.getByLabelText('類別，篩選中')).toBeTruthy();
    expect(screen.queryByText('寫程式')).toBeNull();
    expect(screen.getByText('晨跑')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('年'));
    });
    await screen.findByLabelText('選擇年份');
    expect(screen.getByLabelText('類別，篩選中')).toBeTruthy();

    await choose('全部');
    expect(screen.getByLabelText('類別')).toBeTruthy();
  });

  // VI.10
  it('starts every launch with no Filter, and lets go of the hidden-set #30 stored', async () => {
    await AsyncStorage.setItem(
      'hiddenCategories.v1',
      JSON.stringify({ v: 1, categoryIds: ['c-work'], subcategoryIds: [] }),
    );
    await signIn();

    // The stored 工作 hides nothing, and is gone from the device.
    expect(screen.getByText('晨跑')).toBeTruthy();
    expect(screen.getByLabelText('類別')).toBeTruthy();
    await waitFor(async () => expect(await AsyncStorage.getItem('hiddenCategories.v1')).toBeNull());

    // A Filter chosen now does not outlive the launch.
    await choose('運動');
    expect(screen.queryByText('寫程式')).toBeNull();
    screen.unmount();
    await signIn();
    expect(screen.getByText('晨跑')).toBeTruthy();
    expect(screen.getByLabelText('類別')).toBeTruthy();
  });

  // VI.12
  it('deletes the one chosen Category, and the calendar shows everything again', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    await signIn();
    const reads = (path: string) =>
      api.calls().map(([u]) => String(u)).filter((u) => u.includes(path));

    // Choose only 美食, then delete it from its editor while it is chosen.
    await choose('美食');
    expect(screen.queryByText('寫程式')).toBeNull();
    fireEvent.press(screen.getByLabelText(/^類別/));
    const editButtons = screen.getAllByLabelText('編輯類別');
    fireEvent.press(editButtons[editButtons.length - 1]);
    fireEvent.press(screen.getByText('刪除類別'));
    const destructive = (alertSpy.mock.calls[0][2] ?? []).find((b) => b.style === 'destructive');
    const monthReadsBefore = reads('/months/').length;
    await act(async () => {
      destructive?.onPress?.();
    });
    alertSpy.mockRestore();
    await waitFor(() => expect(screen.queryByText('美食')).toBeNull());

    // A Filter holding only a deleted id is no Filter: 全部 is selected and
    // the rest read as unchosen.
    expect(screen.getByRole('button', { name: '全部', selected: true })).toBeTruthy();
    expect(isHollowRow('工作')).toBe(true);
    expect(isHollowRow('運動')).toBe(true);
    fireEvent.press(screen.getByText('完成'));

    // The month view asks with nothing hidden, is answered, and paints.
    expect(await screen.findByText('寫程式')).toBeTruthy();
    expect(screen.getByText('晨跑')).toBeTruthy();
    expect(screen.getByLabelText('類別')).toBeTruthy();
    await waitFor(() => expect(reads('/months/').length).toBeGreaterThan(monthReadsBefore));
    expect(reads('/months/').at(-1)).not.toContain('hidden');
    const todayDots = () =>
      within(
        within(screen.getByTestId('month-page-current')).getByTestId(`day-dots-${today.getDate()}`),
      ).queryAllByTestId('day-dot');
    await waitFor(() => expect(todayDots()).toHaveLength(2));

    // So does the year view.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('年'));
    });
    await screen.findByLabelText('選擇年份');
    expect(reads('/years/').at(-1)).toMatch(new RegExp(`/years/${today.getFullYear()}$`));
    expect(
      await screen.findByTestId(`year-day-${today.getMonth() + 1}-${today.getDate()}`),
    ).toHaveStyle({ backgroundColor: cat.work.color });
  });

  // ST.7
  it('leaves Entry titles and Category names untouched when the App Language switches', async () => {
    await signIn(
      <AppLanguageProvider>
        <AppRoot />
      </AppLanguageProvider>,
    );

    fireEvent.press(screen.getByLabelText('設定'));
    fireEvent.press(await screen.findByText('語言'));
    await act(async () => {
      fireEvent.press(screen.getByText('English'));
    });
    expect(await screen.findByText('Settings')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Back'));
    });

    // The app speaks English; what the User wrote and named does not change.
    expect(await screen.findByText('寫程式')).toBeTruthy();
    expect(screen.getByText('晨跑')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Categories'));
    expect(screen.getByText('All')).toBeTruthy();
    for (const name of ['工作', '運動', '美食']) expect(screen.getByText(name)).toBeTruthy();
  });
});

describe('the Reminder in 設定 (#136)', () => {
  // A Tuesday morning, so today's 21:00 is still ahead. Only Date is faked:
  // the suite's waits keep real timers.
  const morning = new Date(2026, 10, 10, 9, 30);
  const allButDate = [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate',
    'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
  ] as const;

  const reminderSwitch = () => screen.getByRole('switch', { name: '每日提醒' });
  /** The 提醒時間 row, which shows the time and opens the sheet. */
  const timeRow = () => screen.getByRole('button', { name: '提醒時間' });
  /** When each pending Reminder fires, as local `YYYY-MM-DD HH:MM`. */
  const firings = () =>
    fakeNotifications.scheduled().map((n) => {
      const hh = String(n.date.getHours()).padStart(2, '0');
      const mm = String(n.date.getMinutes()).padStart(2, '0');
      return `${localDateString(n.date)} ${hh}:${mm}`;
    });

  /** Signs in and opens 設定 from the month view's gear. */
  const openSettings = async (tree: React.ReactElement = <AppRoot />) => {
    mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
    render(tree);
    fireEvent.press(await screen.findByLabelText('設定'));
    await screen.findByText('每日提醒');
  };
  const switchOn = async () => {
    await act(async () => {
      fireEvent(reminderSwitch(), 'valueChange', true);
    });
  };

  beforeEach(async () => {
    jest.useFakeTimers({ now: morning, doNotFake: [...allButDate] });
    fakeNotifications.reset();
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await AsyncStorage.clear();
  });

  it("asks once when switched on, then schedules a Reminder a day at 21:00 with the PM's copy", async () => {
    await openSettings();
    expect(reminderSwitch().props.value).toBe(false);
    expect(screen.queryByText('提醒時間')).toBeNull();

    await switchOn();

    expect(fakeNotifications.prompts()).toBe(1);
    expect(reminderSwitch().props.value).toBe(true);
    expect(timeRow()).toHaveAccessibilityValue({ text: '21:00' });
    expect(within(timeRow()).getByText('21:00')).toBeTruthy();
    const pending = fakeNotifications.scheduled();
    expect(pending).toHaveLength(60);
    expect(firings()[0]).toBe('2026-11-10 21:00');
    expect(firings()[1]).toBe('2026-11-11 21:00');
    expect(firings()[59]).toBe('2027-01-08 21:00');
    for (const n of pending) {
      expect(n.title).toBe('今天有什麼小事想記下來嗎？');
      expect(n.body).toBe('一天一行，就好。');
    }
  });

  it('opens a sheet from 提醒時間 with 取消, the title and 儲存 in its header and the wheel at the time', async () => {
    await openSettings();
    await switchOn();

    fireEvent.press(timeRow());

    const sheet = within(screen.getByTestId('reminder-time-sheet'));
    expect(sheet.getByRole('button', { name: '取消' })).toBeTruthy();
    expect(sheet.getByText('提醒時間')).toBeTruthy();
    expect(sheet.getByRole('button', { name: '儲存' })).toBeTruthy();
    expect(sheet.getByTestId('reminder-time')).toHaveAccessibilityValue({ text: '21:00' });
  });

  it('moves every Reminder to the time picked in the sheet once 儲存 is tapped', async () => {
    await openSettings();
    await switchOn();
    fireEvent.press(timeRow());

    fireEvent(screen.getByTestId('reminder-time'), 'valueChange', { type: 'set' }, new Date(2026, 10, 10, 7, 45));
    // Spinning the wheel alone moves nothing.
    expect(firings()[0]).toBe('2026-11-10 21:00');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    expect(screen.queryByTestId('reminder-time-sheet')).toBeNull();
    expect(firings()).toHaveLength(60);
    expect(firings().every((f) => f.endsWith(' 07:45'))).toBe(true);
    // 07:45 has passed this morning: the run starts tomorrow.
    expect(firings()[0]).toBe('2026-11-11 07:45');
    expect(firings()[59]).toBe('2027-01-09 07:45');
    expect(timeRow()).toHaveAccessibilityValue({ text: '07:45' });
    expect(within(timeRow()).getByText('07:45')).toBeTruthy();
    // The sheet opens again at the saved time.
    fireEvent.press(timeRow());
    expect(screen.getByTestId('reminder-time')).toHaveAccessibilityValue({ text: '07:45' });
  });

  it.each([
    ['取消', () => screen.getByText('取消')],
    ['a tap outside the sheet', () => screen.getByTestId('reminder-time-scrim')],
  ])('leaves the time and every Reminder as they were after %s', async (_, closer) => {
    await openSettings();
    await switchOn();
    const before = firings();
    fireEvent.press(timeRow());
    fireEvent(screen.getByTestId('reminder-time'), 'valueChange', { type: 'set' }, new Date(2026, 10, 10, 7, 45));

    await act(async () => {
      fireEvent.press(closer());
    });

    expect(screen.queryByTestId('reminder-time-sheet')).toBeNull();
    expect(firings()).toEqual(before);
    expect(timeRow()).toHaveAccessibilityValue({ text: '21:00' });
    // The spun time is dropped: the sheet opens again at 21:00.
    fireEvent.press(timeRow());
    expect(screen.getByTestId('reminder-time')).toHaveAccessibilityValue({ text: '21:00' });
  });

  it('closes the time sheet with its row when notifications are turned off in iOS', async () => {
    const addListener = jest.mocked(AppState.addEventListener);
    addListener.mockClear();
    const comeBack = () =>
      addListener.mock.calls.forEach(([type, listener]) => {
        if (type === 'change') listener('active');
      });
    await openSettings();
    await switchOn();
    fireEvent.press(timeRow());

    fakeNotifications.setPermission('blocked');
    await act(async () => {
      comeBack();
    });

    expect(screen.queryByTestId('reminder-time-sheet')).toBeNull();
    expect(screen.getByText('前往設定')).toBeTruthy();
    // Allowed again, the row returns but the sheet does not reopen by itself.
    fakeNotifications.setPermission('granted');
    await act(async () => {
      comeBack();
    });
    expect(timeRow()).toBeTruthy();
    expect(screen.queryByTestId('reminder-time-sheet')).toBeNull();
  });

  it('stays off, saying nothing, when the User refuses at the prompt', async () => {
    fakeNotifications.answerPromptWith('deny');
    await openSettings();

    await switchOn();

    expect(fakeNotifications.prompts()).toBe(1);
    expect(reminderSwitch().props.value).toBe(false);
    expect(screen.queryByText('提醒時間')).toBeNull();
    expect(screen.queryByText('前往設定')).toBeNull();
    expect(fakeNotifications.scheduled()).toEqual([]);
  });

  it('explains the refusal the next time 設定 opens, still without prompting', async () => {
    fakeNotifications.answerPromptWith('deny');
    await openSettings();
    await switchOn();
    expect(screen.queryByText('前往設定')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('返回'));
    });
    fireEvent.press(await screen.findByLabelText('設定'));
    await screen.findByText('每日提醒');

    expect(reminderSwitch().props.value).toBe(false);
    expect(screen.getByText('每日提醒需要開啟通知，請到設定允許 Sprinkie 傳送通知。')).toBeTruthy();
    expect(screen.getByText('前往設定')).toBeTruthy();
    expect(fakeNotifications.prompts()).toBe(1);
  });

  it('never prompts once permission is blocked: it explains on opening, and 前往設定 opens the iOS Settings app', async () => {
    const openSettingsApp = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    fakeNotifications.setPermission('blocked');
    await openSettings();
    // Blocked before the switch is ever tried: 設定 already says why (#135 story 9).
    expect(reminderSwitch().props.value).toBe(false);
    expect(screen.getByText('每日提醒需要開啟通知，請到設定允許 Sprinkie 傳送通知。')).toBeTruthy();
    expect(screen.getByText('前往設定')).toBeTruthy();

    await switchOn();

    expect(fakeNotifications.prompts()).toBe(0);
    expect(reminderSwitch().props.value).toBe(false);
    expect(screen.queryByText('提醒時間')).toBeNull();
    expect(fakeNotifications.scheduled()).toEqual([]);
    expect(screen.getByText('每日提醒需要開啟通知，請到設定允許 Sprinkie 傳送通知。')).toBeTruthy();
    fireEvent.press(screen.getByText('前往設定'));
    expect(openSettingsApp).toHaveBeenCalled();
    openSettingsApp.mockRestore();
  });

  it('shows the Reminder off, with the explanation, once notifications are turned off in iOS', async () => {
    await openSettings();
    await switchOn();
    screen.unmount();

    // The User turns Sprinkie's notifications off in the iOS Settings app,
    // then opens Sprinkie again.
    fakeNotifications.setPermission('blocked');
    await openSettings();

    expect(reminderSwitch().props.value).toBe(false);
    expect(screen.queryByText('提醒時間')).toBeNull();
    expect(screen.getByText('前往設定')).toBeTruthy();
    expect(fakeNotifications.prompts()).toBe(1);
  });

  it('cancels every Reminder when switched off', async () => {
    await openSettings();
    await switchOn();

    await act(async () => {
      fireEvent(reminderSwitch(), 'valueChange', false);
    });

    expect(reminderSwitch().props.value).toBe(false);
    expect(screen.queryByText('提醒時間')).toBeNull();
    expect(fakeNotifications.scheduled()).toEqual([]);
  });

  it('schedules again once notifications are allowed in the iOS Settings app and the User comes back', async () => {
    // React Native's jest setup mocks AppState; its recorded listeners stand
    // in for iOS bringing Sprinkie back to the foreground.
    const addListener = jest.mocked(AppState.addEventListener);
    addListener.mockClear();
    const comeBack = () =>
      addListener.mock.calls.forEach(([type, listener]) => {
        if (type === 'change') listener('active');
      });
    await openSettings();
    await switchOn();
    fakeNotifications.setPermission('blocked');
    await act(async () => {
      comeBack();
    });
    expect(screen.getByText('前往設定')).toBeTruthy();
    expect(fakeNotifications.scheduled()).toEqual([]);

    fakeNotifications.setPermission('granted');
    await act(async () => {
      comeBack();
    });

    expect(reminderSwitch().props.value).toBe(true);
    expect(screen.queryByText('前往設定')).toBeNull();
    expect(firings()).toHaveLength(60);
  });

  it('reschedules the run in the new language when the App Language switches', async () => {
    await openSettings(
      <AppLanguageProvider>
        <AppRoot />
      </AppLanguageProvider>,
    );
    await switchOn();

    fireEvent.press(screen.getByText('語言'));
    await act(async () => {
      fireEvent.press(screen.getByText('English'));
    });
    await screen.findByText('Settings');

    await waitFor(() =>
      expect(fakeNotifications.scheduled()[0]?.title).toBe(
        'Is there a small thing from today you want to note down?',
      ),
    );
    const pending = fakeNotifications.scheduled();
    expect(pending).toHaveLength(60);
    expect(firings()[0]).toBe('2026-11-10 21:00');
    for (const n of pending) {
      expect(n.title).toBe('Is there a small thing from today you want to note down?');
      expect(n.body).toBe('One line a day, that is enough.');
    }
  });

  it('tops the run back up to its full length on launch', async () => {
    await openSettings();
    await switchOn();
    screen.unmount();

    // A month passes without Sprinkie being opened: Nov 10 to Dec 10 delivered.
    jest.setSystemTime(new Date(2026, 11, 10, 22, 0));
    expect(fakeNotifications.scheduled()).toHaveLength(29);

    mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');

    await waitFor(() => expect(firings()).toHaveLength(60));
    // 21:00 has passed tonight: the run starts tomorrow.
    expect(firings()[0]).toBe('2026-12-11 21:00');
    expect(firings()[59]).toBe('2027-02-08 21:00');
  });

  describe('when the session ends', () => {
    /** Signs back in on this phone and opens 設定. */
    const signBackIn = async () => {
      const session = { access_token: 'token-2', user: { id: 'u1' } };
      mockAuthState.session = session;
      act(() => mockAuthState.listeners.forEach((listener) => listener('SIGNED_IN', session)));
      fireEvent.press(await screen.findByLabelText('設定'));
      await screen.findByText('每日提醒');
    };

    it('cancels every Reminder and forgets the setting on 登出', async () => {
      await openSettings();
      await switchOn();

      await act(async () => {
        fireEvent.press(screen.getByText('登出'));
      });
      await screen.findByText('每天五分鐘，留下你的生活');
      await waitFor(() => expect(fakeNotifications.scheduled()).toEqual([]));

      await signBackIn();
      expect(reminderSwitch().props.value).toBe(false);
      expect(fakeNotifications.scheduled()).toEqual([]);
    });

    it('does the same when the account is deleted', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      await openSettings();
      await switchOn();

      fireEvent.press(screen.getByText('刪除帳號'));
      const destructive = (alertSpy.mock.calls[0][2] ?? []).find((b) => b.style === 'destructive');
      await act(async () => {
        destructive?.onPress?.();
      });
      alertSpy.mockRestore();
      await screen.findByText('每天五分鐘，留下你的生活');
      await waitFor(() => expect(fakeNotifications.scheduled()).toEqual([]));

      // Signing back in within the grace period restores the account.
      api.restore();
      api = installMockApi();
      await signBackIn();
      expect(reminderSwitch().props.value).toBe(false);
    });

    it('does the same on 登出 from the deactivated screen', async () => {
      await openSettings();
      await switchOn();
      screen.unmount();

      // Deactivated from another phone; this one opens on the gate.
      api.restore();
      api = installMockApi({ deactivated: true });
      render(<AppRoot />);
      await screen.findByText('帳號已停用');
      expect(fakeNotifications.scheduled()).toHaveLength(60);

      await act(async () => {
        fireEvent.press(screen.getByText('登出'));
      });
      await screen.findByText('每天五分鐘，留下你的生活');
      await waitFor(() => expect(fakeNotifications.scheduled()).toEqual([]));

      api.restore();
      api = installMockApi();
      await signBackIn();
      expect(reminderSwitch().props.value).toBe(false);
    });
  });
});

describe('no Reminder on a day that already holds an Entry (#137)', () => {
  // A Tuesday morning, so today's 21:00 is still ahead. Only Date is faked:
  // the suite's waits keep real timers.
  const morning = new Date(2026, 10, 10, 9, 30);
  const today = '2026-11-10';
  const allButDate = [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate',
    'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
  ] as const;

  /** The days the phone holds a Reminder for, soonest first. */
  const reminderDays = () => fakeNotifications.scheduled().map((n) => localDateString(n.date));
  const entry = (id: string, date: string, categoryId: string, title: string): MockEntry => ({
    id, date, position: 1, categoryId, authorId: 'u1', content: encodeContent({ title, note: '' }),
  });
  const currentPage = () => within(screen.getByTestId('month-page-current'));

  /** Signs in on a world with these Entries, and lands on the month view. */
  const launch = async (entries: Record<string, MockEntry[]> = {}) => {
    mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
    api.restore();
    api = installMockApi({
      me: { userId: 'u1', journalId: 'j1', categories: [cat.work, { ...cat.sport, position: 2 }] },
      entries,
    });
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');
  };
  /** Launches, switches the Reminder on in 設定, and comes back to the month view. */
  const launchWithReminderOn = async (entries: Record<string, MockEntry[]> = {}) => {
    await launch(entries);
    fireEvent.press(screen.getByLabelText('設定'));
    await act(async () => {
      fireEvent(await screen.findByRole('switch', { name: '每日提醒' }), 'valueChange', true);
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('返回'));
    });
    await screen.findByLabelText('新增紀錄');
  };
  /** + on the month view's selected day, writes `title` in 運動, 儲存. */
  const writeOnSelectedDay = async (title: string) => {
    await act(async () => {
      fireEvent.press(screen.getByLabelText('新增紀錄'));
    });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.changeText(screen.getByPlaceholderText('標題'), title);
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
  };
  /** Opens today's day view from the month view; today is already selected. */
  const openToday = async () => {
    await act(async () => {
      fireEvent.press(currentPage().getByTestId('day-holder-10'));
    });
    await screen.findByLabelText('返回');
  };
  /** From today's day view: opens the card titled `title`, then 編輯. */
  const editCard = async (title: string) => {
    await act(async () => {
      fireEvent.press(await screen.findByText(title));
    });
    await act(async () => {
      fireEvent.press(await screen.findByText('編輯'));
    });
  };

  beforeEach(async () => {
    jest.useFakeTimers({ now: morning, doNotFake: [...allButDate] });
    fakeNotifications.reset();
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await AsyncStorage.clear();
  });

  it("removes today's Reminder once an Entry dated today is saved, and keeps tomorrow's", async () => {
    await launchWithReminderOn();
    expect(reminderDays()[0]).toBe(today);

    await writeOnSelectedDay('晨跑');

    await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));
    expect(reminderDays()).not.toContain(today);
    expect(fakeNotifications.scheduled()[0].date.getHours()).toBe(21);
  });

  it("brings today's Reminder back when today's only Entry is deleted before the time", async () => {
    await launchWithReminderOn({ [today]: [entry('e1', today, 'c-sport', '晨跑')] });
    await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));
    await openToday();

    await editCard('晨跑');
    const alertSpy = jest.spyOn(Alert, 'alert');
    await act(async () => {
      fireEvent.press(screen.getByText('刪除紀錄'));
    });
    const destructive = (alertSpy.mock.calls[0][2] ?? []).find((b) => b.style === 'destructive');
    await act(async () => {
      destructive?.onPress?.();
    });
    alertSpy.mockRestore();

    await waitFor(() => expect(reminderDays()[0]).toBe(today));
    expect(reminderDays()[1]).toBe('2026-11-11');
  });

  it("brings today's Reminder back when today's only Entry moves to another date", async () => {
    await launchWithReminderOn({ [today]: [entry('e1', today, 'c-sport', '晨跑')] });
    await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));
    await openToday();

    await editCard('晨跑');
    fireEvent.press(screen.getByText('日期'));
    await act(async () => {
      fireEvent.press(within(screen.getByTestId('date-picker-sheet')).getByText('15'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    await waitFor(() => expect(reminderDays()[0]).toBe(today));
  });

  it('counts an Entry outside the Filter: it silences today too', async () => {
    await launchWithReminderOn();
    await choose('工作');

    await writeOnSelectedDay('晨跑');

    await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));
  });

  it("keeps today's Reminder through a failed save, and drops it once the Draft's retry lands", async () => {
    await launchWithReminderOn();
    api.failures.entryWrites = true;

    await writeOnSelectedDay('晨跑');
    expect(await screen.findByText('儲存失敗，請再試一次')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('取消'));
    });
    await screen.findByLabelText('新增紀錄');
    await act(async () => {});
    expect(reminderDays()[0]).toBe(today);

    // The Draft's row on today's day view reopens the form; 儲存 retries.
    api.failures.entryWrites = false;
    await openToday();
    await act(async () => {
      fireEvent.press(await screen.findByText('晨跑'));
    });
    await screen.findByDisplayValue('晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));
  });

  it("leaves today's Reminder in place when an Entry is saved for yesterday", async () => {
    await launchWithReminderOn();
    await act(async () => {
      fireEvent.press(currentPage().getByTestId('day-holder-9'));
    });

    await writeOnSelectedDay('晨跑');
    const [, init] = api.entryPosts().at(-1)!;
    expect(JSON.parse(String(init?.body)).date).toBe('2026-11-09');

    // Give a re-sync the chance to run, then look.
    await act(async () => {});
    expect(reminderDays()[0]).toBe(today);
    expect(reminderDays()).toHaveLength(60);
  });

  it('schedules nothing for today when it launches with an Entry already dated today', async () => {
    await launchWithReminderOn();
    expect(reminderDays()[0]).toBe(today);
    screen.unmount();

    // Today's Entry was written on this phone while Sprinkie was closed.
    api.world.entries[today] = [entry('e1', today, 'c-sport', '晨跑')];
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');

    await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));
    expect(reminderDays()).not.toContain(today);
  });

  describe('launching offline, when today cannot be read', () => {
    /** Closes Sprinkie, then opens it again with day reads failing. */
    const relaunchOffline = async () => {
      screen.unmount();
      api.failures.dayReads = true;
      render(<AppRoot />);
      await screen.findByLabelText('新增紀錄');
      // Let the launch re-sync run its course.
      await act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
    };

    it('still schedules nothing for today once today was known to hold an Entry', async () => {
      await launchWithReminderOn({ [today]: [entry('e1', today, 'c-sport', '晨跑')] });
      await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));

      await relaunchOffline();

      expect(reminderDays()[0]).toBe('2026-11-11');
      expect(reminderDays()).not.toContain(today);
    });

    it('schedules the new day once the date has rolled over', async () => {
      await launchWithReminderOn({ [today]: [entry('e1', today, 'c-sport', '晨跑')] });
      await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));

      jest.setSystemTime(new Date(2026, 10, 11, 9, 30));
      await relaunchOffline();

      expect(reminderDays()[0]).toBe('2026-11-11');
      expect(reminderDays()).toHaveLength(60);
    });

    it("gives the next account today's Reminder, even when the last account's read of today lands after 登出", async () => {
      // React Native's jest setup mocks AppState; its recorded listeners
      // stand in for iOS bringing Sprinkie back to the foreground.
      const addListener = jest.mocked(AppState.addEventListener);
      addListener.mockClear();
      await launchWithReminderOn({ [today]: [entry('e1', today, 'c-sport', '晨跑')] });
      await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));

      // Back in the foreground, the re-sync's read of today is still in
      // flight when the session ends.
      const release = api.holdEntries(today);
      await act(async () => {
        addListener.mock.calls.forEach(([type, listener]) => {
          if (type === 'change') listener('active');
        });
      });
      fireEvent.press(screen.getByLabelText('設定'));
      await act(async () => {
        fireEvent.press(await screen.findByText('登出'));
      });
      await screen.findByText('每天五分鐘，留下你的生活');
      await waitFor(() => expect(fakeNotifications.scheduled()).toEqual([]));
      await act(async () => {
        release();
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      });

      // Another account signs in on this phone, offline, the same day.
      api.failures.dayReads = true;
      const session = { access_token: 'token-2', user: { id: 'u2' } };
      mockAuthState.session = session;
      act(() => mockAuthState.listeners.forEach((listener) => listener('SIGNED_IN', session)));
      fireEvent.press(await screen.findByLabelText('設定'));
      await act(async () => {
        fireEvent(await screen.findByRole('switch', { name: '每日提醒' }), 'valueChange', true);
      });

      await waitFor(() => expect(reminderDays()).toHaveLength(60));
      expect(reminderDays()[0]).toBe(today);
    });

    it('keeps what this session read of today when the phone could not store it', async () => {
      const addListener = jest.mocked(AppState.addEventListener);
      addListener.mockClear();
      // The package's in-memory mock is itself a jest.fn: keep its own
      // implementation for every other key.
      const setItem = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
      const refused = jest
        .spyOn(AsyncStorage, 'setItem')
        .mockImplementation((key, value) =>
          key === 'reminderWrittenDay.v1' ? Promise.reject(new Error('disk full')) : setItem(key, value),
        );
      await launchWithReminderOn({ [today]: [entry('e1', today, 'c-sport', '晨跑')] });
      await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));

      // Back in the foreground, offline.
      api.failures.dayReads = true;
      await act(async () => {
        addListener.mock.calls.forEach(([type, listener]) => {
          if (type === 'change') listener('active');
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      });
      refused.mockImplementation(setItem);

      expect(reminderDays()[0]).toBe('2026-11-11');
      expect(reminderDays()).not.toContain(today);
    });

    it("schedules today again once today's only Entry was deleted", async () => {
      await launchWithReminderOn({ [today]: [entry('e1', today, 'c-sport', '晨跑')] });
      await waitFor(() => expect(reminderDays()[0]).toBe('2026-11-11'));
      await openToday();
      await editCard('晨跑');
      const alertSpy = jest.spyOn(Alert, 'alert');
      await act(async () => {
        fireEvent.press(screen.getByText('刪除紀錄'));
      });
      const destructive = (alertSpy.mock.calls[0][2] ?? []).find((b) => b.style === 'destructive');
      await act(async () => {
        destructive?.onPress?.();
      });
      alertSpy.mockRestore();
      await waitFor(() => expect(reminderDays()[0]).toBe(today));

      await relaunchOffline();

      expect(reminderDays()[0]).toBe(today);
    });
  });
});

describe('tapping a Reminder (#140)', () => {
  // Tonight's Reminder has just arrived. Only Date is faked: the suite's
  // waits keep real timers.
  const evening = new Date(2026, 10, 10, 21, 0, 30);
  const allButDate = [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate',
    'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
  ] as const;
  const tonight = 'reminder-2026-11-10';
  /** The Entry form is open, its header and date row naming `heading`. */
  const expectFormFor = (heading: string) => {
    expect(screen.getByText('儲存')).toBeTruthy();
    expect(screen.getAllByText(heading)).toHaveLength(2);
  };

  /** Signs in, switches 每日提醒 on in 設定 that morning, and closes Sprinkie. */
  const setUpTheReminder = async () => {
    jest.setSystemTime(new Date(2026, 10, 10, 9, 30));
    mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
    render(<AppRoot />);
    fireEvent.press(await screen.findByLabelText('設定'));
    await screen.findByText('每日提醒');
    await act(async () => {
      fireEvent(screen.getByRole('switch', { name: '每日提醒' }), 'valueChange', true);
    });
    screen.unmount();
    jest.setSystemTime(evening);
  };

  beforeEach(async () => {
    jest.useFakeTimers({ now: evening, doNotFake: [...allButDate] });
    fakeNotifications.reset();
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await AsyncStorage.clear();
  });

  it("opens today's Entry form when tapped with Sprinkie closed, and 取消 lands on today's month view", async () => {
    await setUpTheReminder();

    fakeNotifications.tap(tonight);
    render(<AppRoot />);

    await waitFor(() => expectFormFor('11月10日 星期二'));
    await act(async () => {
      fireEvent.press(screen.getByText('取消'));
    });
    expect(await screen.findByText('11月10日 星期二')).toBeTruthy();
    expect(screen.getByLabelText('新增紀錄')).toBeTruthy();
    expect(screen.getByText('11月')).toBeTruthy();
  });

  it("opens today's Entry form when tapped with Sprinkie in the background, and 儲存 lands on today's month view", async () => {
    await setUpTheReminder();
    api.restore();
    api = installMockApi({
      me: { userId: 'u1', journalId: 'j1', categories: [{ ...cat.sport, position: 1 }] },
    });
    // Sprinkie was left in the background on another month's day.
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');
    await act(async () => {
      fireEvent(screen.getByTestId('month-pager'), 'momentumScrollEnd', {
        nativeEvent: { contentOffset: { x: 0 } },
      });
    });
    await screen.findByText('10月');

    await act(async () => {
      fakeNotifications.tap(tonight);
    });

    expectFormFor('11月10日 星期二');
    fireEvent.press(screen.getByText('運動'));
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '夜跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    expect(JSON.parse(String(api.entryPosts()[0][1]?.body)).date).toBe('2026-11-10');
    expect(await screen.findByText('11月')).toBeTruthy();
    expect(screen.getByText('11月10日 星期二')).toBeTruthy();
  });

  it('dates the form by the day of the tap, not the day the Reminder was for', async () => {
    await setUpTheReminder();
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');

    // Last night's Reminder, tapped from Notification Center after midnight.
    jest.setSystemTime(new Date(2026, 10, 11, 0, 10));
    await act(async () => {
      fakeNotifications.tap(tonight);
    });

    expectFormFor('11月11日 星期三');
  });

  it('leaves a form the User is already writing in as it is', async () => {
    await setUpTheReminder();
    api.restore();
    api = installMockApi({
      me: { userId: 'u1', journalId: 'j1', categories: [{ ...cat.sport, position: 1 }] },
    });
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('新增紀錄'));
    });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '還沒寫完');

    await act(async () => {
      fakeNotifications.tap(tonight);
    });

    expect(screen.getByDisplayValue('還沒寫完')).toBeTruthy();
  });

  describe('with a form already open for another day', () => {
    /** Launches on a world with 運動, with yesterday selected on the month view. */
    const launchOnYesterday = async () => {
      await setUpTheReminder();
      api.restore();
      api = installMockApi({
        me: { userId: 'u1', journalId: 'j1', categories: [{ ...cat.sport, position: 1 }] },
      });
      render(<AppRoot />);
      await screen.findByLabelText('新增紀錄');
      await act(async () => {
        fireEvent.press(within(screen.getByTestId('month-page-current')).getByTestId('day-holder-9'));
      });
    };
    /** From yesterday's day view, opens its + form. */
    const openYesterdaysDayForm = async () => {
      await act(async () => {
        fireEvent.press(within(screen.getByTestId('month-page-current')).getByTestId('day-holder-9'));
      });
      await screen.findByLabelText('返回');
      await act(async () => {
        fireEvent.press(screen.getByLabelText('新增紀錄'));
      });
      expectFormFor('11月9日 星期一');
    };

    it("swaps a form with nothing written in it for today's", async () => {
      await launchOnYesterday();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('新增紀錄'));
      });
      expectFormFor('11月9日 星期一');

      await act(async () => {
        fakeNotifications.tap(tonight);
      });

      expectFormFor('11月10日 星期二');
    });

    it('keeps a form with something written in it, on its own day, text and all', async () => {
      await launchOnYesterday();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('新增紀錄'));
      });
      fireEvent.press(screen.getByText('運動'));
      fireEvent.changeText(screen.getByPlaceholderText('標題'), '昨天的事');

      await act(async () => {
        fakeNotifications.tap(tonight);
      });

      expect(screen.getByDisplayValue('昨天的事')).toBeTruthy();
      expectFormFor('11月9日 星期一');
    });

    it("swaps the day view's form with nothing written in it for today's", async () => {
      await launchOnYesterday();
      await openYesterdaysDayForm();

      await act(async () => {
        fakeNotifications.tap(tonight);
      });

      expectFormFor('11月10日 星期二');
    });

    it("keeps the day view's form with something written in it, text and all", async () => {
      await launchOnYesterday();
      await openYesterdaysDayForm();
      fireEvent.press(screen.getByText('運動'));
      fireEvent.changeText(screen.getByPlaceholderText('標題'), '昨天的事');

      await act(async () => {
        fakeNotifications.tap(tonight);
      });

      expect(screen.getByDisplayValue('昨天的事')).toBeTruthy();
      expectFormFor('11月9日 星期一');
    });
  });

  it('shows a Reminder arriving while Sprinkie is open as a banner, and tapping it opens the form', async () => {
    await setUpTheReminder();
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');

    expect(await fakeNotifications.arriveInForeground(tonight)).toEqual({ banner: true, list: true });
    await act(async () => {
      fakeNotifications.tap(tonight);
    });

    expectFormFor('11月10日 星期二');
  });

  describe('signed out, the tap is dropped', () => {
    /** Signs in on the sign-in screen's session, as a provider would. */
    const signIn = async () => {
      const session = { access_token: 'token-2', user: { id: 'u1' } };
      mockAuthState.session = session;
      act(() => mockAuthState.listeners.forEach((listener) => listener('SIGNED_IN', session)));
      await screen.findByLabelText('新增紀錄');
    };
    const expectMonthView = async () => {
      // Long enough for a late form to have opened.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(screen.getByText('11月')).toBeTruthy();
      expect(screen.queryByText('儲存')).toBeNull();
    };

    it('with Sprinkie closed: sign-in opens, and signing in afterwards does not open the form', async () => {
      await setUpTheReminder();
      // Tonight's Reminder arrived; then the User signed out.
      render(<AppRoot />);
      fireEvent.press(await screen.findByLabelText('設定'));
      await act(async () => {
        fireEvent.press(await screen.findByText('登出'));
      });
      await screen.findByText('每天五分鐘，留下你的生活');
      screen.unmount();

      fakeNotifications.tap(tonight);
      render(<AppRoot />);

      expect(await screen.findByText('每天五分鐘，留下你的生活')).toBeTruthy();
      await signIn();
      await expectMonthView();
    });

    it('with Sprinkie in the background on sign-in: signing in afterwards does not open the form', async () => {
      await setUpTheReminder();
      render(<AppRoot />);
      fireEvent.press(await screen.findByLabelText('設定'));
      await act(async () => {
        fireEvent.press(await screen.findByText('登出'));
      });
      await screen.findByText('每天五分鐘，留下你的生活');

      await act(async () => {
        fakeNotifications.tap(tonight);
      });

      expect(screen.getByText('每天五分鐘，留下你的生活')).toBeTruthy();
      await signIn();
      await expectMonthView();
    });

    it('a tap waiting behind the deactivated screen is dropped by 登出 there', async () => {
      await setUpTheReminder();
      api.restore();
      api = installMockApi({ deactivated: true });
      render(<AppRoot />);
      await screen.findByText('帳號已停用');

      await act(async () => {
        fakeNotifications.tap(tonight);
      });
      await act(async () => {
        fireEvent.press(screen.getByText('登出'));
      });
      await screen.findByText('每天五分鐘，留下你的生活');

      api.restore();
      api = installMockApi();
      await signIn();
      await expectMonthView();
    });
  });
});

// The Reminder invite (#138): after a zero-Entry account's first save, the
// calm first-save line, then the sheet offering the Reminder. Once per phone.
describe('the Reminder invite after a first Entry (#138)', () => {
  const firstSaveLine = '第一個生活片段，收藏好了。';
  const inviteTitle = '要不要每天提醒你記一行？';
  // A Tuesday morning, so today's Reminder time is still ahead. Every timer
  // is faked, not only Date: the line's fade and the pointer's run on the
  // test's clock, moved on by hand, so a slow machine cannot outlast them.
  const morning = new Date(2026, 10, 10, 9, 30);
  /** Moves fake time on, and lets whatever it sets off render. */
  const elapse = (ms: number) =>
    act(async () => {
      jest.advanceTimersByTime(ms);
    });

  /** Signs in on a world whose Category reports `inUse`, landing on the month view. */
  const signIn = async ({ inUse = false } = {}) => {
    mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
    api.restore();
    api = installMockApi({
      me: { userId: 'u1', journalId: 'j1', categories: [{ ...cat.sport, position: 1, inUse }] },
    });
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');
  };
  /** Writes an Entry from the month view's +. */
  const saveEntry = async (title = '晨跑') => {
    await act(async () => {
      fireEvent.press(screen.getByLabelText('新增紀錄'));
    });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.changeText(screen.getByPlaceholderText('標題'), title);
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    await screen.findByLabelText('新增紀錄');
  };

  beforeEach(async () => {
    jest.useFakeTimers({ now: morning });
    fakeNotifications.reset();
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await AsyncStorage.clear();
  });

  it("shows the line, then the sheet with the wheel at 21:00, after a zero-Entry account's first save", async () => {
    await signIn();
    expect(screen.queryByText(firstSaveLine)).toBeNull();

    await saveEntry();

    expect(await screen.findByText(firstSaveLine)).toBeTruthy();
    expect(screen.queryByText(inviteTitle)).toBeNull();
    await elapse(lineFadeMs);
    expect(screen.getByText(inviteTitle)).toBeTruthy();
    expect(screen.queryByText(firstSaveLine)).toBeNull();
    expect(screen.getByText('選個喜歡的時間，偶爾忙到忘記也沒關係。')).toBeTruthy();
    expect(screen.getByTestId('reminder-invite-time')).toHaveAccessibilityValue({ text: '21:00' });
    expect(screen.getByText('先不用')).toBeTruthy();
    expect(screen.getByText('設定提醒')).toBeTruthy();
    // Nothing is asked or scheduled until the User chooses.
    expect(fakeNotifications.prompts()).toBe(0);
    expect(fakeNotifications.scheduled()).toEqual([]);
  });

  /** Saves the first Entry and waits out the line for the sheet. */
  const reachSheet = async () => {
    await signIn();
    await saveEntry();
    await screen.findByText(firstSaveLine);
    await elapse(lineFadeMs);
    screen.getByText(inviteTitle);
  };
  /** When each pending Reminder fires, as local `YYYY-MM-DD HH:MM`. */
  const firings = () =>
    fakeNotifications.scheduled().map((n) => {
      const hh = String(n.date.getHours()).padStart(2, '0');
      const mm = String(n.date.getMinutes()).padStart(2, '0');
      return `${localDateString(n.date)} ${hh}:${mm}`;
    });
  const openSettings = async () => {
    fireEvent.press(screen.getByLabelText('設定'));
    await screen.findByText('每日提醒');
  };
  const reminderSwitch = () => screen.getByRole('switch', { name: '每日提醒' });

  it('設定提醒 asks iOS once, then turns the Reminder on at the picked time, as 設定 then shows', async () => {
    await reachSheet();
    fireEvent(screen.getByTestId('reminder-invite-time'), 'valueChange', { type: 'set' }, new Date(2026, 10, 10, 22, 30));

    await act(async () => {
      fireEvent.press(screen.getByText('設定提醒'));
    });

    expect(fakeNotifications.prompts()).toBe(1);
    expect(screen.queryByText(inviteTitle)).toBeNull();
    // Today already holds the first Entry, so the run starts tomorrow (#137).
    expect(firings()).toHaveLength(59);
    expect(firings().every((f) => f.endsWith(' 22:30'))).toBe(true);
    expect(firings()[0]).toBe('2026-11-11 22:30');
    await openSettings();
    expect(reminderSwitch().props.value).toBe(true);
    expect(screen.getByRole('button', { name: '提醒時間' })).toHaveAccessibilityValue({
      text: '22:30',
    });
  });

  it('設定提醒 does not prompt when notifications are already allowed', async () => {
    fakeNotifications.setPermission('granted');
    await reachSheet();

    await act(async () => {
      fireEvent.press(screen.getByText('設定提醒'));
    });

    expect(fakeNotifications.prompts()).toBe(0);
    expect(screen.queryByText(inviteTitle)).toBeNull();
    expect(firings()).toHaveLength(59);
    expect(firings().every((f) => f.endsWith(' 21:00'))).toBe(true);
    expect(firings()[0]).toBe('2026-11-11 21:00');
  });

  it('closes, saying nothing, when the User refuses at the prompt; the Reminder stays off', async () => {
    fakeNotifications.answerPromptWith('deny');
    await reachSheet();

    await act(async () => {
      fireEvent.press(screen.getByText('設定提醒'));
    });

    expect(fakeNotifications.prompts()).toBe(1);
    expect(screen.queryByText(inviteTitle)).toBeNull();
    expect(screen.queryByText('之後可以到設定開啟每日提醒。')).toBeNull();
    expect(fakeNotifications.scheduled()).toEqual([]);
    await openSettings();
    expect(reminderSwitch().props.value).toBe(false);
    // Opened afterwards, 設定 says why (#135 story 9).
    expect(screen.getByText('前往設定')).toBeTruthy();
  });

  it('closes without a prompt once notifications are blocked, pointing to 設定 for later', async () => {
    fakeNotifications.setPermission('blocked');
    await reachSheet();

    await act(async () => {
      fireEvent.press(screen.getByText('設定提醒'));
    });

    expect(fakeNotifications.prompts()).toBe(0);
    expect(screen.queryByText(inviteTitle)).toBeNull();
    expect(screen.getByText('之後可以到設定開啟每日提醒。')).toBeTruthy();
    expect(fakeNotifications.scheduled()).toEqual([]);
    // The pointer fades on its own.
    await elapse(pointerFadeMs);
    expect(screen.queryByText('之後可以到設定開啟每日提醒。')).toBeNull();
  });

  it('先不用 closes it; nothing is asked or scheduled', async () => {
    await reachSheet();

    await act(async () => {
      fireEvent.press(screen.getByText('先不用'));
    });

    expect(screen.queryByText(inviteTitle)).toBeNull();
    expect(fakeNotifications.prompts()).toBe(0);
    expect(fakeNotifications.scheduled()).toEqual([]);
  });

  it('a tap outside the sheet closes it too', async () => {
    await reachSheet();

    await act(async () => {
      fireEvent.press(screen.getByTestId('reminder-invite-scrim'));
    });

    expect(screen.queryByText(inviteTitle)).toBeNull();
    expect(fakeNotifications.prompts()).toBe(0);
    expect(fakeNotifications.scheduled()).toEqual([]);
  });

  /** Lets an invite that would be due come, if it were coming. */
  const settle = () => elapse(200);

  it('never shows the line or the sheet again on this phone, whatever is saved later', async () => {
    await reachSheet();
    await act(async () => {
      fireEvent.press(screen.getByText('先不用'));
    });

    await saveEntry('夜跑');
    await settle();
    expect(screen.queryByText(firstSaveLine)).toBeNull();

    // Relaunched on a world /me still reports as without Entries.
    screen.unmount();
    await signIn();
    await saveEntry('散步');
    await settle();
    expect(screen.queryByText(firstSaveLine)).toBeNull();
    expect(screen.queryByText(inviteTitle)).toBeNull();
  });

  it('never shows either to an account that already had Entries', async () => {
    await signIn({ inUse: true });

    await saveEntry();
    await settle();

    expect(screen.queryByText(firstSaveLine)).toBeNull();
    expect(screen.queryByText(inviteTitle)).toBeNull();
  });

  it("counts a first Entry written from the day view, playing once back on the month view", async () => {
    await signIn();
    const today = new Date();
    await act(async () => {
      fireEvent.press(
        within(screen.getByTestId('month-page-current')).getByTestId(`day-holder-${today.getDate()}`),
      );
    });
    await screen.findByLabelText('返回');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('新增紀錄'));
    });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    await screen.findByLabelText('返回');
    await settle();
    expect(screen.queryByText(firstSaveLine)).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('返回'));
    });

    expect(await screen.findByText(firstSaveLine)).toBeTruthy();
    await elapse(lineFadeMs);
    expect(screen.getByText(inviteTitle)).toBeTruthy();
  });

  /** From the month view, opens today's day view. */
  const openToday = async () => {
    await act(async () => {
      fireEvent.press(
        within(screen.getByTestId('month-page-current')).getByTestId(`day-holder-${new Date().getDate()}`),
      );
    });
    await screen.findByLabelText('返回');
  };

  it('keeps the invite for later when Sprinkie is closed before the month view comes back', async () => {
    await signIn();
    await openToday();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('新增紀錄'));
    });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    await screen.findByLabelText('返回');
    // Closed from the day view: the line never played.
    screen.unmount();

    // Relaunched on a world /me still reports as without Entries.
    await signIn();
    await saveEntry('夜跑');

    expect(await screen.findByText(firstSaveLine)).toBeTruthy();
    await elapse(lineFadeMs);
    expect(screen.getByText(inviteTitle)).toBeTruthy();
  });

  it('plays again, line and sheet, when the User leaves the month view while the line shows', async () => {
    await signIn();
    await saveEntry();
    await screen.findByText(firstSaveLine);

    // The line lets touches through: 設定 opens over it.
    await openSettings();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('返回'));
    });
    await screen.findByLabelText('新增紀錄');

    expect(await screen.findByText(firstSaveLine)).toBeTruthy();
    await elapse(lineFadeMs);
    expect(screen.getByText(inviteTitle)).toBeTruthy();
  });

  /** Reaches the sheet with notifications blocked and taps 設定提醒, so the pointer shows. */
  const reachPointer = async () => {
    fakeNotifications.setPermission('blocked');
    await reachSheet();
    await act(async () => {
      fireEvent.press(screen.getByText('設定提醒'));
    });
    screen.getByText('之後可以到設定開啟每日提醒。');
  };

  it('plays neither again when the User opens 設定 while the blocked pointer shows, then comes back', async () => {
    await reachPointer();

    // The pointer lets touches through, as the line does.
    await openSettings();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('返回'));
    });
    await screen.findByLabelText('新增紀錄');

    await settle();
    expect(screen.queryByText(firstSaveLine)).toBeNull();
    expect(screen.queryByText(inviteTitle)).toBeNull();
  });

  it('offers nothing to another zero-Entry account on this phone once the sheet has appeared, even after 登出 mid-sequence', async () => {
    await reachPointer();
    await openSettings();
    await act(async () => {
      fireEvent.press(screen.getByText('登出'));
    });
    await screen.findByText('每天五分鐘，留下你的生活');

    // Another account without Entries signs in on this phone.
    api.restore();
    api = installMockApi({
      me: { userId: 'u2', journalId: 'j2', categories: [{ ...cat.sport, position: 1, inUse: false }] },
    });
    const session = { access_token: 'token-2', user: { id: 'u2' } };
    mockAuthState.session = session;
    act(() => mockAuthState.listeners.forEach((listener) => listener('SIGNED_IN', session)));
    await screen.findByLabelText('新增紀錄');
    await saveEntry('散步');

    await settle();
    expect(screen.queryByText(firstSaveLine)).toBeNull();
    expect(screen.queryByText(inviteTitle)).toBeNull();
  });

  it('never offers it again once the sheet has appeared, even when Sprinkie is closed while it shows', async () => {
    await reachSheet();
    // Closed with the sheet still up: the offer was made.
    screen.unmount();

    // Relaunched on a world /me still reports as without Entries.
    await signIn();
    await saveEntry('夜跑');

    await settle();
    expect(screen.queryByText(firstSaveLine)).toBeNull();
    expect(screen.queryByText(inviteTitle)).toBeNull();
  });

  it("never plays after a delete on the day view, which is no first Entry", async () => {
    // /me still reports no Category in use, as before a first save.
    mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
    api.restore();
    const today = localDateString(new Date());
    api = installMockApi({
      me: { userId: 'u1', journalId: 'j1', categories: [{ ...cat.sport, position: 1, inUse: false }] },
      entries: {
        [today]: [{
          id: 'e1', date: today, position: 1, categoryId: cat.sport.id, authorId: 'u1',
          content: encodeContent({ title: '晨跑', note: '' }),
        }],
      },
    });
    render(<AppRoot />);
    await screen.findByLabelText('新增紀錄');
    await openToday();
    await act(async () => {
      fireEvent.press(await screen.findByText('晨跑'));
    });
    await act(async () => {
      fireEvent.press(await screen.findByText('編輯'));
    });
    const alertSpy = jest.spyOn(Alert, 'alert');
    await act(async () => {
      fireEvent.press(screen.getByText('刪除紀錄'));
    });
    const destructive = (alertSpy.mock.calls[0][2] ?? []).find((b) => b.style === 'destructive');
    await act(async () => {
      destructive?.onPress?.();
    });
    alertSpy.mockRestore();
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('返回'));
    });
    await screen.findByLabelText('新增紀錄');

    await settle();
    expect(screen.queryByText(firstSaveLine)).toBeNull();
    expect(screen.queryByText(inviteTitle)).toBeNull();
  });

  it('with the Reminder already on, plays the line but offers no sheet, and only once', async () => {
    await signIn();
    await openSettings();
    await act(async () => {
      fireEvent(reminderSwitch(), 'valueChange', true);
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('返回'));
    });
    await screen.findByLabelText('新增紀錄');

    await saveEntry();

    expect(await screen.findByText(firstSaveLine)).toBeTruthy();
    await elapse(lineFadeMs);
    expect(screen.queryByText(firstSaveLine)).toBeNull();
    await settle();
    expect(screen.queryByText(inviteTitle)).toBeNull();

    await saveEntry('夜跑');
    await settle();
    expect(screen.queryByText(firstSaveLine)).toBeNull();
  });
});
