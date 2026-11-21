import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { Switch, TextField } from './Fields';
import { Menu } from './Menu';
import { Modal } from './Modal';

describe('ui components', () => {
  it('Switch reports the new value', () => {
    const onChange = vi.fn();
    render(<Switch label="Memories" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Memories' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('TextField is controlled', () => {
    const onChange = vi.fn();
    render(<TextField label="Name" value="Ann" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bob' } });
    expect(onChange).toHaveBeenCalledWith('Bob');
  });

  it('Modal closes on Escape', () => {
    const onClose = vi.fn();
    render(<Modal title="Hello" onClose={onClose}>body</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('ConfirmDialog runs the action, then closes', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog title="Delete?" message="Sure" confirmText="Delete" onConfirm={onConfirm} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalled();
  });

  it('Menu hides hidden items and runs the chosen one', () => {
    const run = vi.fn();
    render(<Menu trigger={({ toggle }) => <button onClick={toggle}>open</button>} items={[{ label: 'A', onClick: run }, { label: 'B', hidden: true }]} />);
    fireEvent.click(screen.getByText('open'));
    expect(screen.queryByText('B')).toBeNull();
    fireEvent.click(screen.getByText('A'));
    expect(run).toHaveBeenCalled();
  });
});
