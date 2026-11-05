import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { expectSingleLineField } from '../testing/expectSingleLineField';
import { SignInScreen } from './SignInScreen';

const mockSignInWithPassword = jest.fn(async (_args: unknown) => ({ error: null }));
const mockSignUp = jest.fn(async (_args: unknown) => ({ data: { session: null }, error: null }));
jest.mock('../auth/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (args: unknown) => mockSignInWithPassword(args),
      signUp: (args: unknown) => mockSignUp(args),
      signInWithIdToken: jest.fn(),
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
  mockSignInWithPassword.mockClear();
  mockSignUp.mockClear();
});

it('signs in with email and password from its own page', async () => {
  render(<SignInScreen />);

  fireEvent.press(screen.getByText('使用電子郵件登入'));

  fireEvent.changeText(screen.getByPlaceholderText('電子郵件'), 'pm@wlog.local');
  fireEvent.changeText(screen.getByPlaceholderText('密碼'), 'secret-123');
  await act(async () => {
    fireEvent.press(screen.getByText('登入'));
  });

  expect(mockSignInWithPassword).toHaveBeenCalledWith({
    email: 'pm@wlog.local',
    password: 'secret-123',
  });
});

it('shows the flat error line when sign-in fails', async () => {
  mockSignInWithPassword.mockResolvedValueOnce({ error: new Error('nope') } as never);
  render(<SignInScreen />);

  fireEvent.press(screen.getByText('使用電子郵件登入'));

  fireEvent.changeText(screen.getByPlaceholderText('電子郵件'), 'pm@wlog.local');
  fireEvent.changeText(screen.getByPlaceholderText('密碼'), 'wrong');
  await act(async () => {
    fireEvent.press(screen.getByText('登入'));
  });

  expect(screen.getByText('登入失敗，請再試一次')).toBeTruthy();
});

// SI.7 (#109)
it('returns from the email page to the provider screen on the back chevron', () => {
  render(<SignInScreen />);
  fireEvent.press(screen.getByText('使用電子郵件登入'));
  expect(screen.getByPlaceholderText('電子郵件')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('返回'));

  expect(screen.queryByPlaceholderText('電子郵件')).toBeNull();
  expect(screen.getByText('每天五分鐘，留下你的生活')).toBeTruthy();
  expect(screen.getByText('使用電子郵件登入')).toBeTruthy();
});

// SI.11 (#109)
describe('submitting with an empty email or password does nothing', () => {
  it.each([
    ['登入', '', ''],
    ['登入', 'pm@wlog.local', ''],
    ['登入', '', 'secret-123'],
    ['登入', '   ', 'secret-123'],
    ['建立帳戶', '', ''],
    ['建立帳戶', 'pm@wlog.local', ''],
    ['建立帳戶', '', 'secret-123'],
  ])('%s with email "%s" and password "%s"', async (submit, email, password) => {
    render(<SignInScreen />);
    fireEvent.press(screen.getByText('使用電子郵件登入'));
    if (submit === '建立帳戶') fireEvent.press(screen.getByText('還沒有帳戶？註冊'));

    fireEvent.changeText(screen.getByPlaceholderText('電子郵件'), email);
    fireEvent.changeText(screen.getByPlaceholderText('密碼'), password);
    await act(async () => {
      fireEvent.press(screen.getByText(submit));
    });

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockSignUp).not.toHaveBeenCalled();
    // Still the same page, as typed, with nothing said.
    expect(screen.getByPlaceholderText('電子郵件').props.value).toBe(email);
    expect(screen.getByPlaceholderText('密碼').props.value).toBe(password);
    expect(screen.queryByText('登入失敗，請再試一次')).toBeNull();
    expect(screen.queryByText('確認電子郵件')).toBeNull();
  });
});

describe('single-line fields (#42)', () => {
  it.each(['電子郵件', '密碼'])('sizes the %s field for CJK, at the hit target', (placeholder) => {
    render(<SignInScreen />);
    fireEvent.press(screen.getByText('使用電子郵件登入'));

    expectSingleLineField(placeholder);
  });
});
