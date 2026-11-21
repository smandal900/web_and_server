import { mdiCrownOutline } from '@mdi/js';
import { useAbout } from '../../hooks/useServer';
import { EmptyState } from '../../components/ui/Misc';
import { t } from '../../i18n';

/** The /buy page. Licensing is a server feature; until the server has it, this shows the current state. */
export default function Buy() {
  const about = useAbout().data;
  return (
    <div className="h-full">
      <EmptyState
        icon={mdiCrownOutline}
        title={about?.licensed ? t('Thank you for supporting this server') : t('No license is needed')}
        text={t('This server is self-hosted and does not require a purchase. If a license key feature is added to the server, you can enter your key here.')}
      />
    </div>
  );
}
