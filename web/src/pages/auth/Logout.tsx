import { useEffect } from 'react';
import { Navigate } from 'react-router';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAuth } from '../../state/AuthProvider';

/** /auth/logout ends the session, then the guard sends the visitor to the login page. */
export default function Logout() {
  const { user, logout } = useAuth();
  useEffect(() => {
    if (user) void logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return user ? <PageSpinner /> : <Navigate to="/auth/login" replace />;
}
