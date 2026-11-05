import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { expectSingleLineField } from '../testing/expectSingleLineField';
import { SignInScreen } from './SignInScreen';

// Every auth call lands in one log, so a test can read the order the
// screen made them in as well as their arguments.
type Result = { data?: unknown; error: unknown };
const mockCalls: [string, ...unknown[]][] = [];
// A queued Promise holds its call open until the test settles it.
const mockResults: Record<string, (Result | Promise<Result>)[]> = {};
function mockCall(name: string, fallback: Result) {
  return async (...args: unknown[]) => {
    mockCalls.push([name, ...args]);
    return (await mockResults[name]?.shift()) ?? fallback;
  };
}
const mockAuth = {
  signInWithPassword: mockCall('signInWithPassword', { error: null }),
  signUp: mockCall('signUp', { data: { session: null }, error: null }),
  resetPasswordForEmail: mockCall('resetPasswordForEmail', { data: {}, error: null }),
  verifyOtp: mockCall('verifyOtp', { data: {}, error: null }),
  updateUser: mockCall('updateUser', { data: {}, error: null }),
  resend: mockCall('resend', { data: {}, error: null }),
  signOut: mockCall('signOut', { error: null }),
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

async function reachNewPassword(code = '123456') {
  await requestResetCode();
  type('驗證碼', code);
  await press('下一步');
}

it('resets a forgotten password by a typed code and signs the User in', async () => {
  openEmailPage();

  await press('忘記密碼？');
  expect(screen.getByText('重設密碼')).toBeTruthy();
  expect(screen.getByText('輸入註冊時的電子郵件，我們會寄送 6 位數驗證碼。')).toBeTruthy();
  type('電子郵件', 'pm@wlog.local');
  await press('寄送驗證碼');

  // 重設密碼 stays the title through every step of the reset.
  expect(screen.getByText('重設密碼')).toBeTruthy();
  expect(screen.getByText('已寄送 6 位數驗證碼至 pm@wlog.local')).toBeTruthy();
  type('驗證碼', '123456');
  await press('下一步');

  // The code is checked only with the new password, so 下一步 sends nothing.
  expect(mockCalls).toEqual([['resetPasswordForEmail', 'pm@wlog.local']]);
  expect(screen.getByText('重設密碼')).toBeTruthy();
  type('新密碼', 'new-secret');
  await press('更新並登入');

  expect(mockCalls).toEqual([
    ['resetPasswordForEmail', 'pm@wlog.local'],
    ['verifyOtp', { email: 'pm@wlog.local', token: '123456', type: 'recovery' }],
    ['updateUser', { password: 'new-secret' }],
  ]);
  expect(screen.queryByText('更新密碼失敗，請再試一次')).toBeNull();
});

it('sends a wrong or expired code back to the code step, saying so', async () => {
  // GoTrue answers a wrong code and an expired one alike: 403 otp_expired.
  mockResults.verifyOtp = [{ data: {}, error: { code: 'otp_expired', status: 403 } }];
  await reachNewPassword('000000');

  type('新密碼', 'new-secret');
  await press('更新並登入');

  expect(screen.getByText('驗證碼錯誤或已過期')).toBeTruthy();
  expect(screen.getByPlaceholderText('驗證碼')).toBeTruthy();
  expect(screen.queryByPlaceholderText('新密碼')).toBeNull();
  expect(mockCalls.map(([name]) => name)).not.toContain('updateUser');
});

it('asks for at least 6 characters before checking the code', async () => {
  await reachNewPassword();

  type('新密碼', '12345');
  await press('更新並登入');

  expect(screen.getByText('密碼至少需要 6 個字元')).toBeTruthy();
  expect(screen.getByPlaceholderText('新密碼')).toBeTruthy();
  expect(mockCalls.map(([name]) => name)).toEqual(['resetPasswordForEmail']);
});

it('signs the verified code back out when the new password fails to save', async () => {
  mockResults.updateUser = [{ data: {}, error: { code: 'same_password', status: 422 } }];
  await reachNewPassword();

  type('新密碼', 'old-secret');
  await press('更新並登入');

  // No session with the old password outlives the failed save.
  expect(mockCalls.slice(1).map(([name, args]) => [name, args])).toEqual([
    ['verifyOtp', { email: 'pm@wlog.local', token: '123456', type: 'recovery' }],
    ['updateUser', { password: 'old-secret' }],
    ['signOut', { scope: 'local' }],
  ]);
  // The verified code is spent: back to the code step, empty, and a new
  // code can be had at once rather than after the wait.
  expect(screen.getByText('更新密碼失敗，請再試一次')).toBeTruthy();
  expect(screen.getByPlaceholderText('驗證碼')).toBeTruthy();
  expect(screen.queryByDisplayValue('123456')).toBeNull();
  expect(screen.queryByPlaceholderText('新密碼')).toBeNull();
  await press('重新寄送');
  expect(mockCalls.at(-1)).toEqual(['resetPasswordForEmail', 'pm@wlog.local']);
});

it('keeps an unspent code when checking it fails for another reason, so a retry reuses it', async () => {
  // A network failure, not GoTrue's otp_expired: the code was never checked.
  mockResults.verifyOtp = [{ data: {}, error: { status: 0 } }];
  await reachNewPassword();
  type('新密碼', 'new-secret');

  await press('更新並登入');

  expect(screen.getByText('更新密碼失敗，請再試一次')).toBeTruthy();
  expect(screen.getByPlaceholderText('新密碼')).toBeTruthy();
  expect(mockCalls.map(([name]) => name)).toEqual(['resetPasswordForEmail', 'verifyOtp']);

  await press('更新並登入');

  expect(mockCalls.slice(2)).toEqual([
    ['verifyOtp', { email: 'pm@wlog.local', token: '123456', type: 'recovery' }],
    ['updateUser', { password: 'new-secret' }],
  ]);
});

async function submitSignUp() {
  openEmailPage();
  fireEvent.press(screen.getByText('還沒有帳戶？註冊'));
  type('電子郵件', 'pm@wlog.local');
  type('密碼', 'secret-123');
  await press('建立帳戶');
}

it('says a code that failed to send failed to send', async () => {
  mockResults.resetPasswordForEmail = [{ data: {}, error: { status: 0 } }];
  await requestResetCode();

  expect(screen.getByText('寄送失敗，請再試一次')).toBeTruthy();
  expect(screen.getByText('寄送驗證碼')).toBeTruthy();
});

describe('an address that already has an account', () => {
  it.each([
    // With confirmations on, Supabase hides the account: a user, no identities.
    ['a user with no identities', { data: { user: { identities: [] }, session: null }, error: null }],
    // With them off, it says so.
    ['user_already_exists', { data: { user: null, session: null }, error: { code: 'user_already_exists', status: 422 } }],
  ])('stays on the sign-up form and points to 登入 or 忘記密碼 (%s)', async (_answer, answer) => {
    mockResults.signUp = [answer];
    await submitSignUp();

    expect(screen.getByText('此電子郵件已註冊，請直接登入或使用忘記密碼。')).toBeTruthy();
    expect(screen.getByText('建立帳戶')).toBeTruthy();
    expect(screen.queryByPlaceholderText('驗證碼')).toBeNull();
  });
});

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

  const waitSeconds = (seconds: number) => {
    for (let s = 0; s < seconds; s++) act(() => jest.advanceTimersByTime(1000));
  };
  const back = () => fireEvent.press(screen.getByLabelText('返回'));
  const resetCalls = () => mockCalls.filter(([name]) => name === 'resetPasswordForEmail');

  it('holds the wait when the User backs out and asks again for the same address', async () => {
    await requestResetCode();
    waitSeconds(10);
    back();

    await press('寄送驗證碼');

    expect(resetCalls()).toHaveLength(1);
    expect(screen.getByPlaceholderText('驗證碼')).toBeTruthy();
    expect(screen.getByText('重新寄送（20 秒）')).toBeTruthy();
  });

  it('sends at once for another address', async () => {
    await requestResetCode();
    back();

    type('電子郵件', 'yunchi@wlog.local');
    await press('寄送驗證碼');

    expect(resetCalls()).toEqual([
      ['resetPasswordForEmail', 'pm@wlog.local'],
      ['resetPasswordForEmail', 'yunchi@wlog.local'],
    ]);
    expect(screen.getByText('重新寄送（30 秒）')).toBeTruthy();
  });

  it("does not hold a reset to a sign-up's wait", async () => {
    await submitSignUp();
    waitSeconds(10);
    back();
    fireEvent.press(screen.getByText('已有帳戶？登入'));
    await press('忘記密碼？');

    await press('寄送驗證碼');

    expect(resetCalls()).toHaveLength(1);
    expect(screen.getByText('重新寄送（30 秒）')).toBeTruthy();
  });

  it('says a resend that failed to send failed to send', async () => {
    mockResults.resend = [{ data: {}, error: { status: 0 } }];
    await submitSignUp();
    for (let s = 0; s < 30; s++) act(() => jest.advanceTimersByTime(1000));
    await press('重新寄送');

    expect(screen.getByText('寄送失敗，請再試一次')).toBeTruthy();
    expect(screen.getByText('重新寄送')).toBeTruthy();
  });
});

describe('single-line fields (#42)', () => {
  it('sizes the code and new-password fields for CJK, at the hit target', async () => {
    await requestResetCode();
    expectSingleLineField('驗證碼');

    type('驗證碼', '123456');
    await press('下一步');
    expectSingleLineField('新密碼');
  });
});

describe('the back chevron steps back one step', () => {
  const back = () => fireEvent.press(screen.getByLabelText('返回'));

  it('through 忘記密碼, to the sign-in form and then off the page', async () => {
    await reachNewPassword();
    expect(screen.getByPlaceholderText('新密碼')).toBeTruthy();

    back();
    expect(screen.getByPlaceholderText('驗證碼')).toBeTruthy();
    back();
    expect(screen.getByText('寄送驗證碼')).toBeTruthy();
    back();
    expect(screen.getByText('電子郵件登入')).toBeTruthy();
    expect(screen.getByText('忘記密碼？')).toBeTruthy();
    back();
    expect(screen.getByText('使用電子郵件登入')).toBeTruthy();
  });

  it('from a sign-up code, to the sign-up form as typed', async () => {
    await submitSignUp();
    expect(screen.getByText('確認電子郵件')).toBeTruthy();

    back();

    expect(screen.getByText('電子郵件登入')).toBeTruthy();
    expect(screen.getByText('建立帳戶')).toBeTruthy();
    expect(screen.getByDisplayValue('pm@wlog.local')).toBeTruthy();
  });
});

describe('while a request runs', () => {
  it('the button shows it is working, and settles when the answer comes', async () => {
    let answer: (result: Result) => void = () => {};
    mockResults.signInWithPassword = [new Promise<Result>((resolve) => (answer = resolve))];
    openEmailPage();
    type('電子郵件', 'pm@wlog.local');
    type('密碼', 'secret-123');

    await press('登入');

    // Busy is what VoiceOver announces; the spinner itself has no text to read.
    expect(screen.getByRole('button', { name: '登入', busy: true })).toBeTruthy();
    expect(screen.queryByText('登入')).toBeNull();

    await act(async () => answer({ error: null }));
    expect(screen.getByRole('button', { name: '登入', busy: false })).toBeTruthy();
    expect(screen.getByText('登入')).toBeTruthy();
  });

  it('a double tap inside one render pass sends once', async () => {
    openEmailPage();
    await press('忘記密碼？');
    type('電子郵件', 'pm@wlog.local');

    await act(async () => {
      fireEvent.press(screen.getByText('寄送驗證碼'));
      fireEvent.press(screen.getByText('寄送驗證碼'));
    });

    expect(mockCalls).toEqual([['resetPasswordForEmail', 'pm@wlog.local']]);
  });
});
