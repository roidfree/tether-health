import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import * as api from './api';

const TOKEN_KEY = 'tether_access_token';
const REFRESH_TOKEN_KEY = 'tether_refresh_token';
const LANGUAGE_KEY = 'tether_language';

type AuthContextValue = {
  isLoading: boolean;
  token: string | null;
  profile: api.Profile | null;
  language: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<api.Profile | null>(null);
  // Mirrors profile.preferred_language, but persisted locally so the
  // login/signup screens (which run before any profile is loaded) can still
  // render in a returning user's language instead of always defaulting to
  // English.
  const [language, setLanguage] = useState('en');
  const refreshTokenRef = useRef<string | null>(null);

  const applyProfile = (me: api.Profile) => {
    setProfile(me);
    setLanguage(me.preferred_language);
    SecureStore.setItemAsync(LANGUAGE_KEY, me.preferred_language);
  };

  const storeSession = async (accessToken: string, refreshToken: string | null) => {
    refreshTokenRef.current = refreshToken;
    setToken(accessToken);
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  };

  const clearSession = async () => {
    refreshTokenRef.current = null;
    setToken(null);
    setProfile(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  };

  // A session that's expired beyond repair (refresh token itself invalid,
  // not just the access token) previously left the user stranded on
  // whatever screen they were on - token silently went null in context, but
  // nothing navigated them anywhere, so every action on that screen just
  // silently no-op'd with zero feedback. Route back to login instead.
  const forceReauth = async () => {
    await clearSession();
    router.replace('/login');
  };

  // Access tokens expire after an hour - api.ts calls these on a 401 so a
  // stale session refreshes transparently instead of every screen surfacing
  // "Invalid or expired token" once the app's been open a while.
  useEffect(() => {
    api.configureSession({
      getRefreshToken: () => refreshTokenRef.current,
      onRefreshed: ({ accessToken, refreshToken }) => {
        storeSession(accessToken, refreshToken);
      },
      onSessionExpired: () => {
        forceReauth();
      },
    });
  }, []);

  useEffect(() => {
    (async () => {
      const storedLanguage = await SecureStore.getItemAsync(LANGUAGE_KEY);
      if (storedLanguage) setLanguage(storedLanguage);

      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      refreshTokenRef.current = storedRefreshToken;

      if (storedToken) {
        // Set optimistically before getMe - if the token is stale, getMe's
        // internal 401 retry refreshes and calls onRefreshed with the new
        // token, which must win. Setting it only *after* getMe returns would
        // let this stale value clobber that refreshed one instead.
        setToken(storedToken);
        try {
          const me = await api.getMe(storedToken);
          applyProfile(me);
        } catch {
          // getMe already retries through a refresh internally on a 401, so
          // if it still failed the session is genuinely gone.
          await clearSession();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const applySession = async (session: api.AuthResponse) => {
    await storeSession(session.access_token, session.refresh_token);
    const me = await api.getMe(session.access_token);
    applyProfile(me);
  };

  const signIn = async (email: string, password: string) => {
    const session = await api.login(email, password);
    await applySession(session);
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const session = await api.signUp(email, password, fullName);
    await applySession(session);
  };

  const signOut = async () => {
    // Same as forceReauth: clearing the token in context alone doesn't
    // navigate anywhere, so tapping "Log out" from dashboard/carer-home
    // looked like it did nothing - state cleared silently, screen stayed put.
    await forceReauth();
  };

  const refreshProfile = async () => {
    if (!token) return;
    const me = await api.getProfile(token);
    applyProfile(me);
  };

  const value = useMemo(
    () => ({ isLoading, token, profile, language, signIn, signUp, signOut, refreshProfile }),
    [isLoading, token, profile, language]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
