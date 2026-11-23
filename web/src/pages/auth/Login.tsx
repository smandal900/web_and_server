import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { mdiLogin } from '@mdi/js';
import { errorMessage } from '../../api/client';
import { oauthAuthorize, oauthCallback } from '../../api/core';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { PageSpinner } from '../../components/ui/Spinner';
import { useServerConfig, usePublicConfig } from '../../hooks/useServer';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthProvider';

/** Only follow "continue" links that stay on this site. */
const safeTarget = (value: string | null) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/photos');

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, login, refresh } = useAuth();
  const serverConfig = useServerConfig();
  const publicConfig = usePublicConfig().data;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const target = safeTarget(params.get('continue'));

  // Returning from the OAuth provider: the address now carries ?code=...&state=...
  useEffect(() => {
    if (!params.get('code') || !params.get('state')) return;
    oauthCallback(location.href)
      .then(() => refresh())
      .then(() => navigate(target, { replace: true }))
      .catch((e) => setError(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (serverConfig.isLoading || !publicConfig) return <PageSpinner />;
  if (serverConfig.data && !serverConfig.data.isInitialized) return <Navigate to="/auth/register" replace />;
  if (user) return <Navigate to={target} replace />;

  const passwordLogin = publicConfig.passwordLogin?.enabled !== false;
  const oauth = publicConfig.oauth;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startOauth = async () => {
    try {
      const { url } = await oauthAuthorize(`${location.origin}/auth/login`);
      location.href = url;
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <AuthLayout title={t('Login')}>
      {passwordLogin && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextField label={t('Email')} type="email" autoComplete="email" required value={email} onChange={setEmail} />
          <TextField label={t('Password')} type="password" autoComplete="current-password" required value={password} onChange={setPassword} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" icon={mdiLogin} loading={busy}>
            {t('Login')}
          </Button>
        </form>
      )}
      {oauth?.enabled && (
        <div className="mt-4 flex flex-col gap-3">
          {passwordLogin && <div className="text-center text-xs text-muted">{t('or')}</div>}
          <Button variant="outline" onClick={startOauth}>
            {oauth.buttonText || t('Login with OAuth')}
          </Button>
          {!passwordLogin && error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
      {!passwordLogin && !oauth?.enabled && <p className="text-center text-sm text-muted">{t('Login is disabled.')}</p>}
    </AuthLayout>
  );
}
