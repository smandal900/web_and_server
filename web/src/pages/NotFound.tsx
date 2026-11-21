import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { mdiAlertCircleOutline, mdiMapMarkerQuestionOutline } from '@mdi/js';
import { EmptyState } from '../components/ui/Misc';
import { Button } from '../components/ui/Button';
import { t } from '../i18n';

export default function NotFound() {
  return (
    <div className="h-full">
      <EmptyState icon={mdiMapMarkerQuestionOutline} title={t('Page not found')} text={t('The address may be wrong, or the page was moved.')}>
        <Link to="/photos">
          <Button>{t('Back to photos')}</Button>
        </Link>
      </EmptyState>
    </div>
  );
}

/** Router-level error screen (a crash while rendering a route). */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : t('Unknown error');
  return (
    <div className="h-full">
      <EmptyState icon={mdiAlertCircleOutline} title={t('Something went wrong')} text={message}>
        <Button onClick={() => location.assign('/photos')}>{t('Back to photos')}</Button>
      </EmptyState>
    </div>
  );
}
