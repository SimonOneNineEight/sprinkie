import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { localDateString } from './calendar/monthMath';
import { encodeContent } from './entries/content';
import { cat } from './testing/fixtures';
import { installMockApi, type MockApi } from './testing/mockApi';
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
it('returns to the year you came from, not the current one (#40 item 10)', async () => {
  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;
  mockAuthState.session = { access_token: 'token-1', user: { id: 'u1' } };
  render(<AppRoot />);
  await screen.findByLabelText('新增紀錄');

  // Month view → year view, back one year, into that year's March.
  await act(async () => {
    fireEvent.press(screen.getByLabelText('年'));
  });
  await screen.findByLabelText('選擇年份');
  act(() => {
    fireGestureHandler(getByGestureTestId('year-fling-prev'), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END },
    ]);
  });
  expect(screen.getByText(`${lastYear}年`)).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('3月'));
  });
  expect(await screen.findByText('3月')).toBeTruthy();

  // ‹年 from there zooms back out to the year that month belongs to.
  await act(async () => {
    fireEvent.press(screen.getByLabelText('年'));
  });
  await waitFor(() => expect(screen.getByLabelText('選擇年份')).toBeTruthy());
  expect(screen.getByText(`${lastYear}年`)).toBeTruthy();
  expect(screen.queryByText(`${thisYear}年`)).toBeNull();
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
