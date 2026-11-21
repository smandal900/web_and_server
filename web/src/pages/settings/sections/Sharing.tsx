import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { t } from '../../../i18n';

/** Sharing is managed on its own page; this is the doorway from settings. */
export default function SharingSettings() {
  return (
    <div className="flex flex-col items-start gap-3 text-sm">
      <p className="text-muted">{t('Partners, shared albums and shared links are managed on the Sharing page.')}</p>
      <div className="flex flex-wrap gap-2">
        <Link to="/sharing">
          <Button variant="outline">{t('Partners and shared albums')}</Button>
        </Link>
        <Link to="/sharing/sharedlinks">
          <Button variant="outline">{t('Shared links')}</Button>
        </Link>
        <Link to="/people">
          <Button variant="outline">{t('Share people')}</Button>
        </Link>
      </div>
    </div>
  );
}
