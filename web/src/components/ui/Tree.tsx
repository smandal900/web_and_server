import { useState } from 'react';
import { mdiChevronRight, mdiFolderOutline } from '@mdi/js';
import { cx } from '../../lib/cx';
import type { TreeNode } from '../../lib/tree';
import { Icon } from './Icon';

function Node({ node, selected, onSelect, depth, icon }: { node: TreeNode; selected?: string; onSelect: (path: string) => void; depth: number; icon: string }) {
  const [open, setOpen] = useState(selected === node.path || !!selected?.startsWith(`${node.path}/`));
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div className={cx('flex items-center rounded-lg pr-2 hover:bg-panel', selected === node.path && 'bg-primary/15 text-primary')} style={{ paddingLeft: depth * 16 }}>
        <button type="button" aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(!open)} className={cx('p-1', !hasChildren && 'invisible')}>
          <Icon path={mdiChevronRight} size={18} className={cx('transition-transform', open && 'rotate-90')} />
        </button>
        <button type="button" onClick={() => onSelect(node.path)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm">
          <Icon path={icon} size={20} />
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {open && hasChildren && (
        <ul>
          {node.children.map((c) => (
            <Node key={c.path} node={c} selected={selected} onSelect={onSelect} depth={depth + 1} icon={icon} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** An expandable list of nested names. `selected` is a full path like "Trips/2024". */
export function Tree({ nodes, selected, onSelect, icon = mdiFolderOutline }: { nodes: TreeNode[]; selected?: string; onSelect: (path: string) => void; icon?: string }) {
  return (
    <ul role="tree">
      {nodes.map((n) => (
        <Node key={n.path} node={n} selected={selected} onSelect={onSelect} depth={0} icon={icon} />
      ))}
    </ul>
  );
}
