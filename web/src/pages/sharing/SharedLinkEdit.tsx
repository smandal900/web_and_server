import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getSharedLink, updateSharedLink } from '../../api/library';
import { defaultLinkForm, linkFormToInput, SharedLinkForm, type LinkFormValue } from '../../components/sharing/SharedLinkForm';
import { Button } from '../../components/ui/Button';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';

export default function SharedLinkEdit() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const run = useRun();
  const link = useQuery({ queryKey: ['shared-link', id], queryFn: () => getSharedLink(id), retry: false });
  const [form, setForm] = useState<LinkFormValue>({ ...defaultLinkForm, expiry: 'keep' });

  useEffect(() => {
    const l = link.data;
    if (l) {
      setForm({
        description: l.description ?? '',
        password: '',
        slug: l.slug ?? '',
        expiry: 'keep',
        allowDownload: l.allowDownload,
        showMetadata: l.showMetadata,
        allowUpload: l.allowUpload,
      });
    }
  }, [link.data]);

  if (link.isLoading) return <PageSpinner />;

  const save = async () => {
    const result = await run(() => updateSharedLink(id, linkFormToInput(form)), { success: t('Link updated'), invalidate: [['shared-links'], ['shared-link', id]] });
    if (result.ok) navigate('/sharing/sharedlinks');
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Edit shared link')}>
        <Button variant="outline" onClick={() => navigate('/sharing/sharedlinks')}>
          {t('Cancel')}
        </Button>
        <Button onClick={save}>{t('Save')}</Button>
      </PageHeader>
      <PageBody narrow>
        {link.isError ? <p className="text-danger">{(link.error as Error).message}</p> : <SharedLinkForm value={form} onChange={setForm} editing />}
      </PageBody>
    </div>
  );
}
