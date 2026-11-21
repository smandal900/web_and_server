import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

/** A plain styled table: <Table head={['Name','Email']}> rows of <Row cells=...> </Table>. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-panel text-xs font-semibold uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Row({ cells, className, onClick }: { cells: ReactNode[]; className?: string; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={cx('hover:bg-panel-2', onClick && 'cursor-pointer', className)}>
      {cells.map((cell, i) => (
        <td key={i} className="px-4 py-3 align-middle">
          {cell}
        </td>
      ))}
    </tr>
  );
}
