import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { setOnboarded } from '../../api/core';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Fields';
import { LANGUAGES, t } from '../../i18n';
import { useLanguage } from '../../state/I18nProvider';
import { useTheme, type ThemeChoice } from '../../state/ThemeProvider';

const STEPS = ['welcome', 'theme', 'language', 'done'] as const;

/** A short first-run walkthrough for the admin. Finishing it marks the admin as onboarded on the server. */
export default function Onboarding() {
  const [step, setStep] = useState(0);
  const { choice, setChoice } = useTheme();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const current = STEPS[step];

  const finish = async () => {
    await setOnboarded(true).catch(() => undefined);
    qc.setQueryData(['onboarding'], { isOnboarded: true });
    navigate('/photos', { replace: true });
  };

  return (
    <AuthLayout title={t('Getting started')}>
      <div className="min-h-40 text-center">
        {current === 'welcome' && (
          <>
            <h2 className="mb-2 text-lg font-medium">{t('Welcome to your photo server')}</h2>
            <p className="text-sm text-muted">{t('Back up photos and videos, browse them by date, and share them. A few quick choices first.')}</p>
          </>
        )}
        {current === 'theme' && (
          <div className="mx-auto max-w-xs text-left">
            <h2 className="mb-3 text-center text-lg font-medium">{t('Choose a theme')}</h2>
            <Select
              label={t('Theme')}
              value={choice}
              onChange={(v) => setChoice(v as ThemeChoice)}
              options={[
                { value: 'system', label: t('Follow system') },
                { value: 'light', label: t('Light') },
                { value: 'dark', label: t('Dark') },
              ]}
            />
          </div>
        )}
        {current === 'language' && (
          <div className="mx-auto max-w-xs text-left">
            <h2 className="mb-3 text-center text-lg font-medium">{t('Choose a language')}</h2>
            <Select label={t('Language')} value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} />
          </div>
        )}
        {current === 'done' && (
          <>
            <h2 className="mb-2 text-lg font-medium">{t('All set')}</h2>
            <p className="text-sm text-muted">{t('You can change these and more in Account settings. Administrators will find server options under Administration.')}</p>
          </>
        )}
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
          {t('Back')}
        </Button>
        {step < STEPS.length - 1 ? <Button onClick={() => setStep(step + 1)}>{t('Next')}</Button> : <Button onClick={finish}>{t('Start')}</Button>}
      </div>
    </AuthLayout>
  );
}
