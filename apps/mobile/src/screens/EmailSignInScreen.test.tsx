import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { SignInScreen } from './SignInScreen';

// Every auth call lands in one log, so a test can read the order the
// screen made them in as well as their arguments.
type Result = { data?: unknown; error: unknown };
const mockCalls: [string, ...unknown[]][] = [];
const mockResults: Record<string, Result[]> = {};
function mockCall(name: string, fallback: Result) {
  return async (...args: unknown[]) => {
    mockCalls.push([name, ...args]);
    return mockResults[name]?.shift() ?? fallback;
  };
}
const mockAuth = {
  signInWithPassword: mockCall('signInWithPassword', { error: null }),
  signUp: mockCall('signUp', { data: { session: null }, error: null }),
  resetPasswordForEmail: mockCall('resetPasswordForEmail', { data: {}, error: null }),
  verifyOtp: mockCall('verifyOtp', { data: {}, error: null }),
  updateUser: mockCall('updateUser', { data: {}, error: null }),
  resend: mockCall('resend', { data: {}, error: null }),
  signInWithIdToken: jest.fn(),
};
jest.mock('../auth/supabase', () => ({
  supabase: {
    get auth() {
      return mockAuth;
    },
  },
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(),
}));

beforeEach(() => {
  mockCalls.length = 0;
  for (const name of Object.keys(mockResults)) delete mockResults[name];
});

async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByText(label));
  });
}

function type(placeholder: string, text: string) {
  fireEvent.changeText(screen.getByPlaceholderText(placeholder), text);
}

function openEmailPage() {
  render(<SignInScreen />);
  fireEvent.press(screen.getByText('使用電子郵件登入'));
}

async function requestResetCode() {
  openEmailPage();
  await press('忘記密碼？');
  type('電子郵件', 'pm@wlog.local');
  await press('寄送驗證碼');
}

it('resets a forgotten password by a typed code and signs the User in', async () => {
  openEmailPage();

  await press('忘記密碼？');
  expect(screen.getByText('重設密碼')).toBeTruthy();
  expect(screen.getByText('輸入註冊時的電子郵件，我們會寄送 6 位數驗證碼。')).toBeTruthy();
  type('電子郵件', 'pm@wlog.local');
  await press('寄送驗證碼');

  expect(screen.getByText('輸入驗證碼')).toBeTruthy();
  expect(screen.getByText('已寄送 6 位數驗證碼至 pm@wlog.local')).toBeTruthy();
  type('驗證碼', '123456');
  await press('下一步');

  expect(screen.getByText('設定新密碼')).toBeTruthy();
  type('新密碼', 'new-secret');
  await press('更新並登入');

  expect(mockCalls).toEqual([
    ['resetPasswordForEmail', 'pm@wlog.local'],
    ['verifyOtp', { email: 'pm@wlog.local', token: '123456', type: 'recovery' }],
    ['updateUser', { password: 'new-secret' }],
  ]);
  expect(screen.queryByText('登入失敗，請再試一次')).toBeNull();
});
