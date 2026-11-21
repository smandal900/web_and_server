import { SHORTCUT_GROUPS } from '../../hooks/useShortcuts';
import { t } from '../../i18n';
import { Modal } from '../ui/Modal';

export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={t('Keyboard shortcuts')} onClose={onClose} size="lg">
      <div className="grid gap-6 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-sm font-semibold text-primary">{t(group.title)}</h3>
            <dl className="space-y-1.5 text-sm">
              {group.items.map(([keys, text]) => (
                <div key={keys + text} className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{t(text)}</dt>
                  <dd>
                    <kbd className="rounded-md border border-line bg-panel px-2 py-0.5 font-mono text-xs whitespace-nowrap">{keys}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
