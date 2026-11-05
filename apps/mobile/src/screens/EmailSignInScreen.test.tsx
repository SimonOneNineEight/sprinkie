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

it('says a wrong or expired code is wrong, and stays on the code step', async () => {
  // GoTrue answers a wrong code and an expired one alike: 403 otp_expired.
  mockResults.verifyOtp = [{ data: {}, error: { code: 'otp_expired', status: 403 } }];
  await requestResetCode();

  type('驗證碼', '000000');
  await press('下一步');

  expect(screen.getByText('驗證碼錯誤或已過期')).toBeTruthy();
  expect(screen.getByText('輸入驗證碼')).toBeTruthy();
  expect(screen.getByPlaceholderText('驗證碼')).toBeTruthy();
  expect(screen.queryByPlaceholderText('新密碼')).toBeNull();
});

it('asks for at least 6 characters before saving a new password', async () => {
  await requestResetCode();
  type('驗證碼', '123456');
  await press('下一步');

  type('新密碼', '12345');
  await press('更新並登入');

  expect(screen.getByText('密碼至少需要 6 個字元')).toBeTruthy();
  expect(screen.getByText('設定新密碼')).toBeTruthy();
  expect(mockCalls.map(([name]) => name)).not.toContain('updateUser');
});

async function submitSignUp() {
  openEmailPage();
  fireEvent.press(screen.getByText('還沒有帳戶？註冊'));
  type('電子郵件', 'pm@wlog.local');
  type('密碼', 'secret-123');
  await press('建立帳戶');
}

it('finishes a sign-up the server wants confirmed with the emailed code', async () => {
  // No session back means the project requires email confirmation.
  await submitSignUp();

  expect(screen.getByText('確認電子郵件')).toBeTruthy();
  expect(screen.getByText('已寄送 6 位數驗證碼至 pm@wlog.local，輸入後即完成註冊。')).toBeTruthy();
  type('驗證碼', '654321');
  await press('完成註冊');

  expect(mockCalls).toEqual([
    ['signUp', { email: 'pm@wlog.local', password: 'secret-123' }],
    ['verifyOtp', { email: 'pm@wlog.local', token: '654321', type: 'email' }],
  ]);
  expect(screen.queryByText('驗證碼錯誤或已過期')).toBeNull();
  expect(screen.queryByText('登入失敗，請再試一次')).toBeNull();
});

it('asks for no code when sign-up comes back signed in, as with confirmations off', async () => {
  mockResults.signUp = [{ data: { session: { access_token: 'token-1' } }, error: null }];
  await submitSignUp();

  expect(mockCalls).toEqual([['signUp', { email: 'pm@wlog.local', password: 'secret-123' }]]);
  expect(screen.queryByText('確認電子郵件')).toBeNull();
  expect(screen.queryByPlaceholderText('驗證碼')).toBeNull();
  expect(screen.queryByText('登入失敗，請再試一次')).toBeNull();
});

describe('重新寄送', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([
    ['sign-up', submitSignUp, ['resend', { type: 'signup', email: 'pm@wlog.local' }]],
    ['reset', requestResetCode, ['resetPasswordForEmail', 'pm@wlog.local']],
  ])('resends the %s code, then waits 30 seconds, counting down', async (_flow, reachCodeStep, resent) => {
    await reachCodeStep();
    const sent = mockCalls.length;

    // The first email has just gone, so the wait starts at once.
    expect(screen.getByText('重新寄送（30 秒）')).toBeTruthy();
    await press('重新寄送（30 秒）');
    expect(mockCalls).toHaveLength(sent);

    // A second at a time, with a render between, as on a device.
    const waitASecond = () => act(() => jest.advanceTimersByTime(1000));
    waitASecond();
    expect(screen.getByText('重新寄送（29 秒）')).toBeTruthy();
    for (let s = 29; s > 1; s--) waitASecond();
    expect(screen.getByText('重新寄送（1 秒）')).toBeTruthy();
    waitASecond();
    await press('重新寄送');

    expect(mockCalls.slice(sent)).toEqual([resent]);
    expect(screen.getByText('重新寄送（30 秒）')).toBeTruthy();
  });
});
