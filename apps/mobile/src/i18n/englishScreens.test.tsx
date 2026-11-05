import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert } from 'react-native';

import { AppLanguageProvider } from './AppLanguageProvider';
import { EntryFormScreen } from '../screens/EntryFormScreen';
import { SpecimenScreen } from '../screens/SpecimenScreen';
import { cat } from '../testing/fixtures';
import { installMockApi } from '../testing/mockApi';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  getCameraPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

// The one place the harness runs in English (#34): an English-language
// phone, no stored override, a screen rendered through the provider.
jest.mock('expo-localization', () => ({
  useLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

describe('an English phone with no override', () => {
  it('renders the specimen screen in English end to end', async () => {
    render(
      <AppLanguageProvider>
        <SpecimenScreen />
      </AppLanguageProvider>,
    );

    expect(await screen.findByText('Design specimen')).toBeTruthy();
    expect(screen.getByText('Semantic colors')).toBeTruthy();
    expect(screen.queryByText('設計樣本')).toBeNull();
  });
});

// #89's alert is copy only an English phone sees; the form is driven to it
// the way EntryFormScreen.test does, with the camera already denied.
describe('the camera-denied alert on an English phone (#89)', () => {
  it('reads in English', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, choose) => choose(0));
    jest.mocked(ImagePicker.getCameraPermissionsAsync).mockResolvedValue({
      granted: false,
      status: 'denied',
      canAskAgain: false,
      expires: 'never',
    } as ImagePicker.PermissionResponse);
    const api = installMockApi();
    render(
      <AppLanguageProvider>
        <EntryFormScreen
          accessToken="tok"
          date="2026-08-17"
          categories={[{ ...cat.sport, position: 1 }]}
          onDone={jest.fn()}
        />
      </AppLanguageProvider>,
    );

    fireEvent.press(await screen.findByText('運動'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('grid-item-__add__'));
    });

    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Camera unavailable');
    expect(message).toBe('Allow camera access for Sprinkie in Settings');
    expect(buttons?.map((b) => b.text)).toEqual(['Cancel', 'Open Settings']);
    api.restore();
    jest.restoreAllMocks();
  });
});
