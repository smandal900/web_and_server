import { Link } from 'react-router';
import { mdiContentDuplicate, mdiMapMarkerOffOutline, mdiPackageVariantClosed } from '@mdi/js';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { useFeatures } from '../../hooks/useServer';
import { t } from '../../i18n';

/** A menu of housekeeping tools. */
export default function Utilities() {
  const features = useFeatures().data;
  const tools = [
    { to: '/utilities/duplicates', icon: mdiContentDuplicate, title: t('Review duplicates'), text: t('Find pictures that look the same and keep the best one.'), off: features?.duplicateDetection === false ? t('Duplicate detection is turned off on the server.') : '' },
    { to: '/utilities/large-files', icon: mdiPackageVariantClosed, title: t('Large files'), text: t('See the biggest files and free up space.'), off: '' },
    { to: '/utilities/geolocation', icon: mdiMapMarkerOffOutline, title: t('Manage locations'), text: t('Add a place to pictures that have none.'), off: '' },
  ];
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Utilities')} />
      <PageBody>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link key={tool.to} to={tool.to} className="flex gap-4 rounded-2xl border border-line bg-panel-2 p-5 transition hover:border-primary hover:bg-panel">
              <Icon path={tool.icon} size={36} className="shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold">{tool.title}</h2>
                <p className="text-sm text-muted">{tool.text}</p>
                {tool.off && <p className="mt-1 text-xs text-warning">{tool.off}</p>}
              </div>
            </Link>
          ))}
        </div>
      </PageBody>
    </div>
  );
}
