import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as api from './api';

const TOKEN_KEY = 'tether_access_token';

type AuthContextValue = {
  isLoading: boolean;
  token: string | null;
  profile: api.Profile | null;
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

  useEffect(() => {
    (async () => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (storedToken) {
        try {
          const me = await api.getMe(storedToken);
          setToken(storedToken);
          setProfile(me);
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const applySession = async (session: api.AuthResponse) => {
    await SecureStore.setItemAsync(TOKEN_KEY, session.access_token);
    setToken(session.access_token);
    const me = await api.getMe(session.access_token);
    setProfile(me);
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
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!token) return;
    const me = await api.getProfile(token);
    setProfile(me);
  };

  const value = useMemo(
    () => ({ isLoading, token, profile, signIn, signUp, signOut, refreshProfile }),
    [isLoading, token, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
