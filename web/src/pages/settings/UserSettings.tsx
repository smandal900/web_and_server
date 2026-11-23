import { lazy, type ComponentType } from 'react';
import {
  mdiAccountOutline,
  mdiChartBox,
  mdiCog,
  mdiCrownOutline,
  mdiDownloadOutline,
  mdiFeatureSearchOutline,
  mdiFingerprint,
  mdiKeyOutline,
  mdiLockOutline,
  mdiMonitorCellphone,
  mdiShareVariantOutline,
  mdiShieldKeyOutline,
  mdiTextBoxCheckOutline,
} from '@mdi/js';
import { Boundary } from '../../components/ui/Boundary';
import { Accordion } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { useFeatures } from '../../hooks/useServer';
import { t } from '../../i18n';

// Every section is its own file, downloaded only when the section is opened.
const Section = (load: () => Promise<{ default: ComponentType }>) => lazy(load);
const Profile = Section(() => import('./sections/Profile'));
const Password = Section(() => import('./sections/Password'));
const Devices = Section(() => import('./sections/Devices'));
const App = Section(() => import('./sections/AppSettings'));
const Features = Section(() => import('./sections/Features'));
const Download = Section(() => import('./sections/Download'));
const SharingSection = Section(() => import('./sections/Sharing'));
const OAuth = Section(() => import('./sections/OAuth'));
const Pin = Section(() => import('./sections/Pin'));
const Passkeys = Section(() => import('./sections/Passkeys'));
const ApiKeys = Section(() => import('./sections/ApiKeys'));
const Usage = Section(() => import('./sections/Usage'));
const Purchase = Section(() => import('./sections/Purchase'));

export default function UserSettings() {
  const features = useFeatures().data;
  const sections: Array<{ title: string; subtitle: string; icon: string; Body: ComponentType; show?: boolean; open?: boolean }> = [
    { title: t('Account'), subtitle: t('Name, email and profile picture'), icon: mdiAccountOutline, Body: Profile, open: true },
    { title: t('Password'), subtitle: t('Change your password'), icon: mdiKeyOutline, Body: Password },
    { title: t('Devices'), subtitle: t('Where you are signed in'), icon: mdiMonitorCellphone, Body: Devices },
    { title: t('App settings'), subtitle: t('Theme and language'), icon: mdiCog, Body: App },
    { title: t('Features'), subtitle: t('Memories, people, folders, tags and more'), icon: mdiFeatureSearchOutline, Body: Features },
    { title: t('Download'), subtitle: t('Archive size and options'), icon: mdiDownloadOutline, Body: Download },
    { title: t('Sharing'), subtitle: t('Partners and shared people'), icon: mdiShareVariantOutline, Body: SharingSection },
    { title: t('OAuth'), subtitle: t('Link your account to a login provider'), icon: mdiShieldKeyOutline, Body: OAuth, show: !!features?.oauth },
    { title: t('PIN code'), subtitle: t('Protect the locked folder'), icon: mdiLockOutline, Body: Pin },
    { title: t('Passkeys'), subtitle: t('Sign in without a password'), icon: mdiFingerprint, Body: Passkeys },
    { title: t('API keys'), subtitle: t('Let other programs use your account'), icon: mdiTextBoxCheckOutline, Body: ApiKeys },
    { title: t('Usage'), subtitle: t('Storage and activity'), icon: mdiChartBox, Body: Usage },
    { title: t('Support'), subtitle: t('Supporter status'), icon: mdiCrownOutline, Body: Purchase },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Account settings')} />
      <PageBody narrow>
        <div className="flex flex-col gap-3">
          {sections
            .filter((s) => s.show !== false)
            .map((s) => (
              <Accordion key={s.title} title={s.title} subtitle={s.subtitle} icon={s.icon} defaultOpen={s.open}>
                <Boundary compact>
                  <s.Body />
                </Boundary>
              </Accordion>
            ))}
        </div>
      </PageBody>
    </div>
  );
}
