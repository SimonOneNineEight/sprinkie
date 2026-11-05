import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AuthApiError } from '@supabase/supabase-js';
import { Alert } from 'react-native';

import { installMockApi, type MockApi } from '../testing/mockApi';
import { SettingsScreen } from './SettingsScreen';

const mockSignOut = jest.fn(async () => ({ error: null }));
// The account's sign-in methods as Supabase holds them (#20).
let mockIdentities: { provider: string }[] = [];
jest.mock('../auth/supabase', () => ({
  supabase: {
    auth: {
      signOut: () => mockSignOut(),
      getUserIdentities: async () => ({ data: { identities: mockIdentities }, error: null }),
      linkIdentity: (args: { provider: string; token: string }) => mockLinkIdentity(args),
    },
  },
}));
// Supabase links the provider's ID token to the signed-in account and hands
// back the account with its identities.
const mockLinkIdentity = jest.fn(async ({ provider }: { provider: string; token: string }) => {
  mockIdentities = [...mockIdentities, { provider }];
  return { data: { user: { identities: mockIdentities }, session: {} }, error: null as unknown };
});
// The two native sign-in sheets, each answering with its ID token.
const mockAppleSignIn = jest.fn(async (_options: unknown) => ({
  identityToken: 'apple-id-token' as string | null,
}));
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: (options: unknown) => mockAppleSignIn(options),
}));
const mockGoogleSignIn = jest.fn(async () => ({
  type: 'success',
  data: { idToken: 'google-id-token' as string | null },
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), signIn: () => mockGoogleSignIn() },
}));
const mockOpenBrowser = jest.fn(async (_url: string) => ({ type: 'cancel' as const }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (url: string) => mockOpenBrowser(url),
}));
jest.mock('../auth/useSession', () => ({
  useSession: () => ({ access_token: 'tok', user: { id: 'u1', email: 'simon@wlog.local' } }),
}));

let api: MockApi;

beforeEach(() => {
  mockSignOut.mockClear();
  mockIdentities = [{ provider: 'email' }];
  mockLinkIdentity.mockClear();
  mockAppleSignIn.mockClear();
  mockGoogleSignIn.mockClear();
  mockOpenBrowser.mockClear();
  api = installMockApi();
});

afterEach(() => {
  api.restore();
});

// Settles the 連結帳戶 read that opening the screen starts (#20).
async function renderSettings(
  overrides: Partial<React.ComponentProps<typeof SettingsScreen>> = {},
) {
  render(<SettingsScreen accessToken="tok" onBack={jest.fn()} {...overrides} />);
  await act(async () => {});
}

it('shows the account row', async () => {
  await renderSettings();
  expect(screen.getByText('simon@wlog.local')).toBeTruthy();
  // 類別 moved out (ratified 2026-08-20): it lives behind the calendar's
  // 類別 sheet, not in settings.
  expect(screen.queryByText('類別')).toBeNull();
});

// The two legal rows (#60). Beta App Review expects a reachable privacy
// policy from an app that collects journal content, and App Store Connect
// wants the same URL. The literal URLs are asserted here rather than the
// constants the screen reads: a test that compares a value to the value it
// came from would pass through any typo.
it('opens the privacy policy in an in-app browser', async () => {
  await renderSettings();
  fireEvent.press(screen.getByText('隱私權政策'));
  expect(mockOpenBrowser).toHaveBeenCalledWith(
    'https://simononenineeight.github.io/sprinkie/privacy/',
  );
});

it('opens the terms in an in-app browser', async () => {
  await renderSettings();
  fireEvent.press(screen.getByText('服務條款'));
  expect(mockOpenBrowser).toHaveBeenCalledWith(
    'https://simononenineeight.github.io/sprinkie/terms/',
  );
});

it('signs out from its own row', async () => {
  await renderSettings();
  fireEvent.press(screen.getByText('登出'));
  expect(mockSignOut).toHaveBeenCalled();
});

it('deletes the account after the 30-day confirm, then signs out', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert');
  await renderSettings();

  fireEvent.press(screen.getByText('刪除帳號'));
  expect(alertSpy).toHaveBeenCalledWith(
    '刪除帳號？',
    '30天內重新登入即可復原。之後所有紀錄、照片與類別將永久刪除。',
    expect.anything(),
  );
  const buttons = alertSpy.mock.calls[0][2] ?? [];
  const destructive = buttons.find((b) => b.style === 'destructive');
  await act(async () => {
    destructive?.onPress?.();
  });

  const del = (globalThis.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'DELETE');
  expect(String(del?.[0])).toContain('/me');
  expect(mockSignOut).toHaveBeenCalled();
  alertSpy.mockRestore();
});

// ST.11 (#109)
it('does nothing when the delete confirmation is cancelled', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert');
  const onBack = jest.fn();
  await renderSettings({ onBack });

  fireEvent.press(screen.getByText('刪除帳號'));
  const buttons = alertSpy.mock.calls[0][2] ?? [];
  const cancel = buttons.find((b) => b.style === 'cancel');
  expect(cancel).toBeTruthy();
  await act(async () => {
    cancel?.onPress?.();
  });

  expect(api.calls().filter(([, init]) => init?.method === 'DELETE')).toEqual([]);
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(onBack).not.toHaveBeenCalled();
  // Still on 設定, the account as it was.
  expect(screen.getByText('simon@wlog.local')).toBeTruthy();
  expect(screen.getByText('刪除帳號')).toBeTruthy();
  alertSpy.mockRestore();
});

describe('連結帳戶 (#20)', () => {
  // A row reads as its provider then its state, e.g. "Apple 已連結". Whether
  // it takes a tap is asserted through toBeDisabled, which reads the
  // disabled state VoiceOver announces rather than anything drawn, a
  // departure from #45's testing rule.
  const row = (provider: string) =>
    screen.findByRole('button', { name: new RegExp(`^${provider}`) });

  it('shows each provider as linked or not, from the account', async () => {
    mockIdentities = [{ provider: 'email' }, { provider: 'apple' }];
    await renderSettings();

    const apple = await row('Apple');
    expect(within(apple).getByText('已連結')).toBeTruthy();
    expect(apple).toBeDisabled();
    const google = await row('Google');
    expect(within(google).getByText('連結')).toBeTruthy();
    expect(google).toBeEnabled();
  });

  it('steers someone with an existing account to link from it', async () => {
    await renderSettings();
    expect(screen.getByText('已有帳戶？請先用原本的方式登入，再從這裡連結。')).toBeTruthy();
  });

  it.each([
    ['Apple', 'apple', 'apple-id-token'],
    ['Google', 'google', 'google-id-token'],
  ])('links %s through its own sign-in, then shows it linked', async (name, provider, token) => {
    await renderSettings();

    await act(async () => {
      fireEvent.press(await row(name));
    });

    expect(mockLinkIdentity).toHaveBeenCalledWith({ provider, token });
    const linked = await row(name);
    expect(within(linked).getByText('已連結')).toBeTruthy();
    expect(linked).toBeDisabled();
  });

  it('says so when the identity belongs to another account, and links nothing', async () => {
    // What Supabase Auth answers when the token's identity is already
    // linked to a different user.
    mockLinkIdentity.mockResolvedValueOnce({
      data: { user: null, session: null } as never,
      error: new AuthApiError(
        'Identity is already linked to another user',
        422,
        'identity_already_exists',
      ),
    });
    await renderSettings();

    await act(async () => {
      fireEvent.press(await row('Google'));
    });

    expect(screen.getByText('此登入方式已屬於另一個帳戶')).toBeTruthy();
    expect(
      screen.getByText('若要連結，請先登入那個帳戶並刪除它；刪除 30 天後，它的登入方式才會釋出。'),
    ).toBeTruthy();
    const google = await row('Google');
    expect(within(google).getByText('連結')).toBeTruthy();
    expect(google).toBeEnabled();
  });

  it.each([
    [
      'Apple',
      () =>
        mockAppleSignIn.mockRejectedValueOnce(
          Object.assign(new Error('The user canceled'), { code: 'ERR_REQUEST_CANCELED' }),
        ),
    ],
    [
      'Google',
      () => mockGoogleSignIn.mockResolvedValueOnce({ type: 'cancelled', data: null as never }),
    ],
  ])('changes nothing when the %s sheet is closed', async (name, closeSheet) => {
    closeSheet();
    await renderSettings();

    await act(async () => {
      fireEvent.press(await row(name));
    });

    expect(mockLinkIdentity).not.toHaveBeenCalled();
    const unlinked = await row(name);
    expect(within(unlinked).getByText('連結')).toBeTruthy();
    expect(unlinked).toBeEnabled();
    expect(screen.queryByText('此登入方式已屬於另一個帳戶')).toBeNull();
    expect(screen.queryByText('登入失敗，請再試一次')).toBeNull();
  });
});
