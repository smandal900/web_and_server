import { mdiClose, mdiDotsVertical, mdiSelectAll } from '@mdi/js';
import { useAssetActions, type ActionContext, type ActionId } from '../../hooks/useAssetActions';
import { useShortcut } from '../../hooks/useShortcuts';
import { t } from '../../i18n';
import { Button, IconButton } from '../ui/Button';
import { Menu } from '../ui/Menu';
import type { GridAsset } from './gridAsset';

const INLINE = 4; // how many actions are shown as buttons; the rest go in the "more" menu

/** A page-specific action (set album cover, set person photo...) offered next to the standard ones. */
export interface CustomAction {
  id: string;
  label: string;
  icon: string;
  run: (ids: string[]) => void | Promise<unknown>;
  /** Return true to hide it for this selection (e.g. only valid for exactly one picture). */
  hidden?: (assets: GridAsset[]) => boolean;
}

/** Asset-picker mode: the bar only offers one button that hands the chosen ids back. */
export interface PickMode {
  label: string;
  onPick: (ids: string[]) => void | Promise<unknown>;
}

interface SelectionBarProps {
  assets: GridAsset[];
  actions: ActionId[];
  custom?: CustomAction[];
  pick?: PickMode;
  context?: ActionContext;
  onClear: () => void;
  onSelectAll?: () => void;
}

/** The bar that replaces the top of the page while pictures are selected. */
export function SelectionBar({ assets, actions: wanted, custom = [], pick, context = {}, onClear, onSelectAll }: SelectionBarProps) {
  const { actions, dialogs } = useAssetActions(assets, context, onClear);
  const has = (id: ActionId) => !pick && wanted.includes(id);

  // Keyboard shortcuts only exist for actions this page offers.
  useShortcut('Escape', onClear);
  useShortcut('Delete', () => (has('trash') ? actions.trash.run() : has('deletePermanent') && actions.deletePermanent.run()));
  useShortcut('f', () => has('favorite') && actions.favorite.run());
  useShortcut('a', () => has('archive') && actions.archive.run(), { modifier: 'shift' });
  useShortcut('d', () => has('download') && actions.download.run());

  const items = [
    ...custom.filter((c) => !c.hidden?.(assets)).map((c) => ({ id: c.id, label: c.label, icon: c.icon, run: () => void c.run(assets.map((a) => a.id)), danger: false })),
    ...(pick ? [] : wanted.map((id) => ({ id, ...actions[id] }))),
  ];
  const inline = items.slice(0, INLINE);
  const more = items.slice(INLINE);

  return (
    <div className="absolute inset-x-0 top-0 z-30 flex h-16 items-center gap-1 border-b border-primary/30 bg-primary/15 px-3 backdrop-blur-md">
      <IconButton path={mdiClose} label={t('Clear selection')} onClick={onClear} />
      <span className="mr-auto ml-1 font-medium">{t('{count} selected', { count: assets.length })}</span>
      {onSelectAll && <IconButton path={mdiSelectAll} label={t('Select all')} onClick={onSelectAll} />}
      {pick && (
        <Button disabled={assets.length === 0} onClick={() => pick.onPick(assets.map((a) => a.id))}>
          {pick.label}
        </Button>
      )}
      {inline.map((a) => (
        <IconButton key={a.id} path={a.icon} label={a.label} onClick={a.run} className={a.danger ? 'hover:text-danger' : ''} />
      ))}
      {more.length > 0 && (
        <Menu
          trigger={({ toggle }) => <IconButton path={mdiDotsVertical} label={t('More')} onClick={toggle} />}
          items={more.map((a) => ({ label: a.label, icon: a.icon, onClick: a.run, danger: a.danger }))}
        />
      )}
      {dialogs}
    </div>
  );
}
