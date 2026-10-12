import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { workspaceFor } from '@/auth/workspace';
import { ToastProvider } from '@/components/toast';
import { AppButton, AppText } from '@/components/primitives';
import { I18nProvider, useI18n } from '@/i18n/I18nProvider';
import { queryClient } from '@/lib/query-client';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { state, profileError, refreshUser, signOut } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (state.status !== 'booting') void SplashScreen.hideAsync();
  }, [state.status]);

  const workspace = state.status === 'signed-in' ? workspaceFor(state.user) : null;
  // Signed in but the profile (and so the workspace) is not known yet.
  const resolvingProfile = state.status === 'signed-in' && workspace === null;

  if (resolvingProfile && profileError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.background }}>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {t('common.loadingErrorTitle')}
        </AppText>
        <AppText variant="small" style={{ textAlign: 'center' }}>
          {t('network.offline')}
        </AppText>
        <AppButton title={t('common.retry')} icon="refresh" onPress={() => void refreshUser()} />
        <AppButton title={t('common.logout')} variant="ghost" onPress={() => void signOut()} />
      </View>
    );
  }

  if (state.status === 'booting' || resolvingProfile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={workspace === 'company'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={workspace === 'platform'}>
        <Stack.Screen name="platform" />
      </Stack.Protected>
      {/* Locked (biometric session saved) and signed-out both use the login
          screen; when locked it offers the fingerprint / Face ID button. */}
      <Stack.Protected guard={state.status === 'signed-out' || state.status === 'locked'}>
        <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <ToastProvider>
              <AuthProvider>
                <StatusBar style="dark" />
                <RootNavigator />
              </AuthProvider>
            </ToastProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
