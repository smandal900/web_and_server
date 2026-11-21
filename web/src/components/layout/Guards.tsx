// Route guards. They decide where a visitor must go before a page may show.
import { Navigate, Outlet, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getAuthStatus } from '../../api/core';
import { call } from '../../api/client';
import { E } from '../../api/endpoints';
import { useServerConfig } from '../../hooks/useServer';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthProvider';
import { Button } from '../ui/Button';
import { PageSpinner } from '../ui/Spinner';

const loginUrl = (from: string) => `/auth/login?continue=${encodeURIComponent(from)}`;

/** The home address "/": go to the right first page. */
export function Landing() {
  const config = useServerConfig();
  const { user, isLoading } = useAuth();
  if (config.isLoading || isLoading) return <PageSpinner />;
  if (config.data && !config.data.isInitialized) return <Navigate to="/auth/register" replace />;
  return <Navigate to={user ? '/photos' : '/auth/login'} replace />;
}

/**
 * Wraps every page that needs a login:
 *   not logged in            -> login (remembering where they were going)
 *   must change password     -> change-password page
 *   admin who has not been through the welcome steps -> onboarding
 */
export function RequireAuth() {
  const { user, isLoading, isError, isAdmin, refresh } = useAuth();
  const { pathname, search } = useLocation();
  const onboarding = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => call<{ isOnboarded: boolean }>(E.users.onboarding),
    enabled: isAdmin,
    retry: false,
    staleTime: Infinity,
  });

  if (isLoading || (isAdmin && onboarding.isLoading)) return <PageSpinner />;
  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p>{t('Cannot reach the server.')}</p>
        <Button onClick={() => refresh()}>{t('Try again')}</Button>
      </div>
    );
  }
  if (!user) return <Navigate to={loginUrl(pathname + search)} replace />;
  if (user.shouldChangePassword && pathname !== '/auth/change-password') return <Navigate to="/auth/change-password" replace />;
  if (isAdmin && onboarding.data && !onboarding.data.isOnboarded && pathname !== '/auth/onboarding') {
    return <Navigate to="/auth/onboarding" replace />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/photos" replace />;
}

/**
 * The locked folder needs the PIN first. `GET /auth/status` tells if this session is unlocked.
 * While the server lacks PIN support (`pinCode` false) the page still opens to the setup screen.
 */
export function RequireUnlocked({ children }: { children: React.ReactNode }) {
  const status = useQuery({ queryKey: ['auth-status'], queryFn: getAuthStatus, retry: false });
  const { pathname } = useLocation();
  if (status.isLoading) return <PageSpinner />;
  if (!status.data?.isElevated) return <Navigate to={`/auth/pin-prompt?continue=${encodeURIComponent(pathname)}`} replace />;
  return <>{children}</>;
}
