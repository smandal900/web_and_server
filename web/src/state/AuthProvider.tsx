import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, setUnauthorizedHandler } from '../api/client';
import { getMe, login as apiLogin, logout as apiLogout } from '../api/core';
import type { User } from '../api/types';

interface AuthValue {
  /** undefined while loading, null when nobody is logged in. */
  user: User | null | undefined;
  isLoading: boolean;
  isError: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
}
const AuthContext = createContext<AuthValue>(null!);
export const useAuth = () => useContext(AuthContext);

/** Who is logged in. The session itself is an HttpOnly cookie, so JavaScript never touches the token. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await getMe();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  // Any 401 from any request means the session ended: forget the user and the guards redirect to login.
  useEffect(() => {
    setUnauthorizedHandler(() => qc.setQueryData(['me'], null));
    return () => {
      setUnauthorizedHandler();
    };
  }, [qc]);

  const login = useCallback(
    async (email: string, password: string) => {
      await apiLogin({ email, password });
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      qc.clear(); // drop every cached picture list of the previous user
      qc.setQueryData(['me'], null);
    }
  }, [qc]);

  const value = useMemo<AuthValue>(
    () => ({
      user: me.data,
      isLoading: me.isLoading,
      isError: me.isError,
      isAdmin: !!me.data?.isAdmin,
      login,
      logout,
      refresh: () => me.refetch(),
    }),
    [me.data, me.isLoading, me.isError, login, logout, me],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
