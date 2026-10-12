import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import AuthLayout from '@/app/(auth)/_layout';
import LanguageScreen from '@/app/(auth)/language';
import { I18nProvider } from '@/i18n/I18nProvider';

// The real auth layout and language screen; login is a stub so the test does
// not depend on the auth stack.
function routes() {
  return {
    _layout: () => (
      <I18nProvider>
        <Slot />
      </I18nProvider>
    ),
    '(auth)/_layout': AuthLayout,
    '(auth)/language': LanguageScreen,
    '(auth)/login': () => <Text>LOGIN SCREEN</Text>,
    '(auth)/forgot-password': () => <Text>FORGOT SCREEN</Text>,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('first-run language selection', () => {
  it('shows the language screen first when no language was chosen', async () => {
    await renderRouter(routes(), { initialUrl: '/login' });
    expect(await screen.findByText('Bienvenue sur BuildStock Pro')).toBeTruthy();
    expect(screen.getByText('Choisissez votre langue pour continuer')).toBeTruthy();
    expect(screen.getByText('Français')).toBeTruthy();
    expect(screen.getByText('العربية')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.queryByText('LOGIN SCREEN')).toBeNull();
  });

  it('previews the copy in the selected language, persists it and continues to login', async () => {
    await renderRouter(routes(), { initialUrl: '/login' });
    await fireEvent.press(await screen.findByText('العربية'));
    expect(screen.getByText('مرحباً بك في BuildStock Pro')).toBeTruthy();
    expect(screen.getByText('اختر اللغة المفضلة لديك للمتابعة')).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByText('متابعة'));
    });
    expect(await AsyncStorage.getItem('app.locale')).toBe('ar');
    expect(await screen.findByText('LOGIN SCREEN')).toBeTruthy();
  });

  it('skips the language screen when a language is already saved', async () => {
    await AsyncStorage.setItem('app.locale', 'en');
    await renderRouter(routes(), { initialUrl: '/login' });
    expect(await screen.findByText('LOGIN SCREEN')).toBeTruthy();
    expect(screen.queryByText('Welcome to BuildStock Pro')).toBeNull();
  });
});
