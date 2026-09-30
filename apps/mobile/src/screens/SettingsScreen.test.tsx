import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { installMockApi, type MockApi } from '../testing/mockApi';
import { SettingsScreen } from './SettingsScreen';

const mockSignOut = jest.fn(async () => ({ error: null }));
jest.mock('../auth/supabase', () => ({
  supabase: { auth: { signOut: () => mockSignOut() } },
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
  mockOpenBrowser.mockClear();
  api = installMockApi();
});

afterEach(() => {
  api.restore();
});

function renderSettings(overrides: Partial<React.ComponentProps<typeof SettingsScreen>> = {}) {
  render(<SettingsScreen accessToken="tok" onBack={jest.fn()} {...overrides} />);
}

it('shows the account row', () => {
  renderSettings();
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
it('opens the privacy policy in an in-app browser', () => {
  renderSettings();
  fireEvent.press(screen.getByText('隱私權政策'));
  expect(mockOpenBrowser).toHaveBeenCalledWith(
    'https://simononenineeight.github.io/sprinkie/privacy/',
  );
});

it('opens the terms in an in-app browser', () => {
  renderSettings();
  fireEvent.press(screen.getByText('服務條款'));
  expect(mockOpenBrowser).toHaveBeenCalledWith(
    'https://simononenineeight.github.io/sprinkie/terms/',
  );
});

it('signs out from its own row', () => {
  renderSettings();
  fireEvent.press(screen.getByText('登出'));
  expect(mockSignOut).toHaveBeenCalled();
});

it('deletes the account after the 30-day confirm, then signs out', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert');
  renderSettings();

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
