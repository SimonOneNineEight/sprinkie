import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { AppLanguageProvider } from '../i18n/AppLanguageProvider';
import { SettingsScreen } from './SettingsScreen';

jest.mock('../auth/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(async () => ({ error: null })),
      // 連結帳戶 (#20) reads the account's sign-in methods on open.
      getUserIdentities: jest.fn(async () => ({ data: { identities: [] }, error: null })),
    },
  },
}));
jest.mock('../auth/useSession', () => ({
  useSession: () => ({ access_token: 'tok', user: { id: 'u1', email: 'simon@wlog.local' } }),
}));

// The App Language rows (#35) need the real provider: the language flip
// must re-render the screen and persist, which the provider-less zh-TW
// default cannot do. The harness phone is Traditional Chinese.
function renderSettings() {
  return render(
    <AppLanguageProvider>
      <SettingsScreen accessToken="tok" onBack={() => {}} />
    </AppLanguageProvider>,
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('the 語言 row and picker (#35)', () => {
  it('offers exactly the three ratified options, endonyms fixed', async () => {
    renderSettings();
    fireEvent.press(await screen.findByText('語言'));

    const sheet = within(screen.getByTestId('language-sheet'));
    expect(sheet.getByText('系統預設')).toBeTruthy();
    expect(sheet.getByText('繁體中文')).toBeTruthy();
    expect(sheet.getByText('English')).toBeTruthy();
  });

  it('choosing English re-renders the whole screen immediately', async () => {
    renderSettings();
    fireEvent.press(await screen.findByText('語言'));
    fireEvent.press(screen.getByText('English'));

    // The nav title, section headers, and row flip without a restart.
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.queryByText('設定')).toBeNull();

    // Reopened in English: System Default translates, the endonym does not.
    fireEvent.press(screen.getByText('Language'));
    expect(screen.getByText('System Default')).toBeTruthy();
    expect(screen.getByText('繁體中文')).toBeTruthy();
  });

  it('the choice survives a remount', async () => {
    const first = renderSettings();
    fireEvent.press(await screen.findByText('語言'));
    fireEvent.press(screen.getByText('English'));
    first.unmount();

    renderSettings();
    expect(await screen.findByText('Settings')).toBeTruthy();
  });
});
