'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';

export interface User {
  id: number;
  uuid: string;
  username: string;
  email: string;
  isAdmin: boolean;
  language: string;
  totpEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { username: string; password: string; totpToken?: string }) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await fetchApi<any>('/api/auth/me');
      const u = res?.data ?? res?.user ?? res;
      if (u && (u.id || u.username)) {
        setUser(u);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: { username: string; password: string; totpToken?: string }) => {
    const res = await fetchApi<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    const u = res?.data?.user ?? res?.user ?? res?.data;
    if (u && (u.id || u.username)) {
      setUser(u);
    }
    return {
      requiresTotp: res?.data?.confirmationToken === 'totp_required' || res?.requiresTotp,
      ...res,
    };
  };

  const logout = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
