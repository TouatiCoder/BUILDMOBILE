import Constants, { ExecutionEnvironment } from 'expo-constants';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError, bindSession } from '@/api/client';
import type { UserProfile } from '@/api/types';
import { useI18n } from '@/i18n/I18nProvider';
import { RELOCK_AFTER_BACKGROUND_MS } from '@/lib/config';
import { queryClient } from '@/lib/query-client';

import { enableLabelKey, getBiometricStatus, promptBiometric, type BiometricStatus } from './biometrics';
import * as session from './session-service';

type AuthState =
  | { status: 'booting' }
  /** `biometricResume`: biometric sign-in was on when the session expired; the next password login turns it back on. */
  | { status: 'signed-out'; notice?: string; biometricResume?: boolean }
  /** `autoPrompt: false` after a deliberate sign-out, so the OS prompt only opens on tap. */
  | { status: 'locked'; email: string; notice?: string; autoPrompt?: boolean }
  | { status: 'signed-in'; user: UserProfile | null };

type AuthContextValue = {
  state: AuthState;
  /** True when the profile could not be loaded (e.g. offline); `refreshUser` retries. */
  profileError: boolean;
  user: UserProfile | null;
  biometricEnabled: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: true; biometricEnabled: boolean } | { ok: false; message: string }>;
  /** Signs out; with biometric sign-in enabled the next login can use it. */
  signOut: () => Promise<void>;
  unlock: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  getBiometricStatus: () => Promise<BiometricStatus>;
  enableBiometric: () => Promise<{ ok: true } | { ok: false; message: string }>;
  disableBiometric: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Drops every cached server response and stops in-flight requests, so nothing
 * fetched for one session can be shown in another. Query keys are not
 * user-scoped; this reset on every session change is what isolates accounts.
 */
function resetServerCache() {
  void queryClient.cancelQueries();
  queryClient.clear();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<AuthState>({ status: 'booting' });
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const unlocking = useRef(false);

  /** Deliberate sign-out: keeps biometric sign-in (if enabled) for the next login. */
  const endSession = useCallback(async () => {
    const token = tokenRef.current;
    tokenRef.current = null;
    resetServerCache();
    const result = await session.signOut(token);
    if (result.kind === 'locked') {
      setState({ status: 'locked', email: result.email, autoPrompt: false });
    } else {
      setBiometricEnabled(false);
      setState({ status: 'signed-out' });
    }
  }, []);

  /** The server rejected the session (401): it is gone, but biometric sign-in resumes after the next password login. */
  const expireSession = useCallback(async () => {
    tokenRef.current = null;
    resetServerCache();
    const resume = await session.expireSession();
    setBiometricEnabled(false);
    setState({ status: 'signed-out', notice: t('session.expired'), biometricResume: resume });
  }, [t]);

  // Any 401 from the API means the server no longer accepts this session.
  useEffect(() => {
    bindSession({
      getToken: () => tokenRef.current,
      onUnauthorized: (sentToken) => {
        // A late 401 for a session that already ended must not end the current one.
        if (sentToken && sentToken === tokenRef.current) void expireSession();
      },
    });
  }, [expireSession]);

  const loadUser = useCallback(async () => {
    setProfileError(false);
    try {
      const user = await session.fetchCurrentUser();
      setState((prev) => (prev.status === 'signed-in' ? { status: 'signed-in', user } : prev));
    } catch (error) {
      // 401 is handled by the global handler; other errors keep the session
      // usable (screens show their own retry states) and are exposed so the
      // root can offer a retry when no profile is known yet.
      if (!(error instanceof ApiError) || error.status !== 401) setProfileError(true);
    }
  }, []);

  const enterSignedIn = useCallback(
    (token: string, user: UserProfile | null) => {
      resetServerCache();
      tokenRef.current = token;
      setState({ status: 'signed-in', user });
      void loadUser();
    },
    [loadUser],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await session.restore();
        if (cancelled) return;
        if (result.kind === 'signed-in') {
          setBiometricEnabled(false);
          enterSignedIn(result.token, result.user ?? null);
        } else if (result.kind === 'locked') {
          setBiometricEnabled(true);
          setState({ status: 'locked', email: result.email });
        } else {
          setState({
            status: 'signed-out',
            notice: result.reason === 'expired' ? t('session.expired') : undefined,
            biometricResume: result.biometricResume,
          });
        }
      } catch {
        if (!cancelled) setState({ status: 'signed-out' });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Boot runs once; `t` changes with the locale only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-lock after the app spent some time in background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (since && biometricEnabled && tokenRef.current && Date.now() - since > RELOCK_AFTER_BACKGROUND_MS) {
          tokenRef.current = null;
          resetServerCache();
          setState((prev) => (prev.status === 'signed-in' ? { status: 'locked', email: prev.user?.email ?? '' } : prev));
        }
      }
    });
    return () => sub.remove();
  }, [biometricEnabled]);

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (email, password) => {
      let result: session.SignInResult;
      try {
        result = await session.signIn(email, password, t('biometric.unlockPrompt'));
      } catch (error) {
        const message =
          error instanceof ApiError && error.kind === 'timeout' ? t('network.timeout') : t('network.offline');
        return { ok: false, message };
      }
      if (!result.ok) {
        const messages: Record<typeof result.reason, string> = {
          'invalid-credentials': t('auth.login.error'),
          'biometric-only-account': t('session.biometricOnlyAccount'),
          'no-session-cookie': t('session.cookieMissing'),
          server: result.message ?? t('auth.login.genericError'),
        };
        return { ok: false, message: messages[result.reason] };
      }
      setBiometricEnabled(result.biometricKept);
      enterSignedIn(result.token, result.user);
      return { ok: true, biometricEnabled: result.biometricKept };
    },
    [enterSignedIn, t],
  );

  const unlock = useCallback(async () => {
    if (unlocking.current) return;
    unlocking.current = true;
    try {
      const result = await session.unlockWithBiometrics(t('biometric.unlockPrompt'));
      if (result.kind === 'unlocked') {
        enterSignedIn(result.token, result.user ?? null);
        return;
      }
      if (result.kind === 'signed-out') {
        setBiometricEnabled(false);
        resetServerCache();
        const notice =
          result.reason === 'enrollment-changed'
            ? t('biometric.enrollmentChanged')
            : result.reason === 'expired'
              ? t('session.expired')
              : undefined;
        setState({ status: 'signed-out', notice, biometricResume: result.biometricResume });
        return;
      }
      setState((prev) =>
        prev.status === 'locked'
          ? { ...prev, notice: t(result.kind === 'cancelled' ? 'biometric.cancelled' : 'biometric.failed') }
          : prev,
      );
    } finally {
      unlocking.current = false;
    }
  }, [enterSignedIn, t]);

  const enableBiometric = useCallback<AuthContextValue['enableBiometric']>(async () => {
    const token = tokenRef.current;
    if (!token) return { ok: false, message: t('session.expired') };
    const status = await getBiometricStatus();
    if (status.state === 'no-hardware') return { ok: false, message: t('biometric.noHardware') };
    if (status.state === 'not-enrolled') return { ok: false, message: t('biometric.notEnrolled') };
    if (status.state === 'weak-only') return { ok: false, message: t('biometric.weakOnly') };
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      return { ok: false, message: t('biometric.devBuildRequired') };
    }
    const presence = await promptBiometric(t('biometric.enablePrompt'), t('common.cancel'));
    if (presence !== 'success') {
      const key =
        presence === 'cancelled'
          ? 'biometric.cancelled'
          : presence === 'lockout'
            ? 'biometric.lockout'
            : presence === 'unavailable'
              ? 'biometric.notEnrolled'
              : 'biometric.failed';
      return { ok: false, message: t(key) };
    }
    const result = await session.enableBiometric(token, t(enableLabelKey(status.kind)));
    if (!result.ok) {
      const key =
        result.reason === 'dev-build-required'
          ? 'biometric.devBuildRequired'
          : result.reason === 'cancelled'
            ? 'biometric.cancelled'
            : 'biometric.enableError';
      return { ok: false, message: t(key) };
    }
    setBiometricEnabled(true);
    return { ok: true };
  }, [t]);

  const disableBiometric = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    await session.disableBiometric(token);
    setBiometricEnabled(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      profileError,
      user: state.status === 'signed-in' ? state.user : null,
      biometricEnabled,
      signIn,
      signOut: endSession,
      unlock,
      refreshUser: loadUser,
      setUser: (user) => setState((prev) => (prev.status === 'signed-in' ? { status: 'signed-in', user } : prev)),
      getBiometricStatus,
      enableBiometric,
      disableBiometric,
    }),
    [state, profileError, biometricEnabled, signIn, endSession, unlock, loadUser, enableBiometric, disableBiometric],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
