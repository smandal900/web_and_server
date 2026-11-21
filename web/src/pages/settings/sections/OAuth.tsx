import { useEffect } from 'react';
import { oauthAuthorize, oauthLink, oauthUnlink } from '../../../api/core';
import { Button } from '../../../components/ui/Button';
import { useRun } from '../../../hooks/useRun';
import { t } from '../../../i18n';
import { useAuth } from '../../../state/AuthProvider';

/** Link this account to the OAuth provider, or unlink it. Returning from the provider carries ?code=... in the address. */
export default function OAuth() {
  const { user, refresh } = useAuth();
  const run = useRun();
  const linked = !!user?.oauthId;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('code') && params.get('state')) {
      run(() => oauthLink(location.href), { success: t('Account linked') }).then(() => {
        history.replaceState({}, '', location.pathname);
        refresh();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = async () => {
    const r = await run(() => oauthAuthorize(`${location.origin}/user-settings`));
    if (r.ok) location.href = r.data.url;
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted">{linked ? t('Your account is linked.') : t('Your account is not linked.')}</p>
      {linked ? (
        <Button variant="outline" onClick={() => run(() => oauthUnlink(), { success: t('Account unlinked') }).then(() => refresh())}>
          {t('Unlink')}
        </Button>
      ) : (
        <Button onClick={link}>{t('Link account')}</Button>
      )}
    </div>
  );
}
