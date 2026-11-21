import { useState, type ReactNode } from 'react';
import { t } from '../../i18n';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmText?: string;
  danger?: boolean;
  /** May be async; the button shows a spinner until it finishes. */
  onConfirm: () => void | Promise<unknown>;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmText = 'Confirm', danger, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };
  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={confirm}>
            {t(confirmText)}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">{message}</div>
    </Modal>
  );
}
