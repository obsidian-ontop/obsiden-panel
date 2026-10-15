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
      const data = await fetchApi<{ user: User }>('/api/auth/me');
      setUser(data.user);
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
    const res = await fetchApi<{ user?: User; requiresTotp?: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (res.user) {
      setUser(res.user);
    }
    return res;
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
