import { lazy, useState } from 'react';
import { Link } from 'react-router';
import { mdiContentCopy, mdiDeleteOutline, mdiLinkVariant, mdiPencilOutline, mdiQrcode } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { thumbnailUrl } from '../../api/assets';
import { deleteSharedLink, getSharedLinks, shareLinkUrl } from '../../api/library';
import type { SharedLink } from '../../api/types';
import { Boundary } from '../../components/ui/Boundary';
import { IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/Misc';
import { Modal } from '../../components/ui/Modal';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { formatDateTime } from '../../lib/format';
import { useToast } from '../../state/ToastProvider';
import { copyText } from '../../lib/clipboard';

const Qrcode = lazy(() => import('../../components/ui/Qrcode'));

const isExpired = (l: SharedLink) => !!l.expiresAt && new Date(l.expiresAt) < new Date();

/** Every public link this user created, with copy / QR / edit / delete. */
export default function SharedLinks() {
  const run = useRun();
  const toast = useToast();
  const links = useQuery({ queryKey: ['shared-links'], queryFn: getSharedLinks });
  const [qr, setQr] = useState<SharedLink | null>(null);
  const [deleting, setDeleting] = useState<SharedLink | null>(null);
  const items = links.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Shared links')} />
      <PageBody>
        {links.isLoading && <PageSpinner />}
        {!links.isLoading && items.length === 0 && (
          <EmptyState icon={mdiLinkVariant} title={t('No shared links')} text={t('Select photos or open an album and use Share to create a link anyone can open.')} />
        )}
        <ul className="grid gap-3">
          {items.map((link) => {
            const cover = link.album?.albumThumbnailAssetId ?? link.assets[0]?.id;
            return (
              <li key={link.id} className="flex items-center gap-4 rounded-2xl border border-line bg-panel-2 p-3">
                {cover ? <img src={thumbnailUrl(cover)} alt="" className="size-20 shrink-0 rounded-xl object-cover" /> : <div className="size-20 shrink-0 rounded-xl bg-panel" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{link.description || link.album?.albumName || t('Shared photos')}</p>
                  <p className="text-xs text-muted">
                    {link.type === 'ALBUM' ? t('Album') : t('{count} photos', { count: link.assets.length })} · {t('Created {date}', { date: formatDateTime(link.createdAt) })}
                  </p>
                  <p className={`text-xs ${isExpired(link) ? 'text-danger' : 'text-muted'}`}>{link.expiresAt ? (isExpired(link) ? t('Expired') : t('Expires {date}', { date: formatDateTime(link.expiresAt) })) : t('Never expires')}</p>
                  <p className="mt-1 text-xs text-muted">
                    {[link.showMetadata && t('Metadata'), link.allowDownload && t('Download'), link.allowUpload && t('Upload'), link.password && t('Password')].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <IconButton path={mdiContentCopy} label={t('Copy link')} onClick={() => copyText(shareLinkUrl(link)).then(() => toast.success(t('Copied to clipboard')))} />
                  <IconButton path={mdiQrcode} label={t('QR code')} onClick={() => setQr(link)} />
                  <Link to={`/shared-links/${link.id}/edit`}>
                    <IconButton path={mdiPencilOutline} label={t('Edit')} />
                  </Link>
                  <IconButton path={mdiDeleteOutline} label={t('Delete')} onClick={() => setDeleting(link)} />
                </div>
              </li>
            );
          })}
        </ul>
      </PageBody>
      {qr && (
        <Modal title={t('QR code')} size="sm" onClose={() => setQr(null)}>
          <div className="flex flex-col items-center gap-3">
            <Boundary compact>
              <Qrcode value={shareLinkUrl(qr)} />
            </Boundary>
            <code className="text-xs break-all">{shareLinkUrl(qr)}</code>
          </div>
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title={t('Delete this link?')}
          message={t('Anyone who has the link will lose access.')}
          confirmText="Delete"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={() => run(() => deleteSharedLink(deleting.id), { success: t('Link deleted'), invalidate: [['shared-links']] })}
        />
      )}
    </div>
  );
}
