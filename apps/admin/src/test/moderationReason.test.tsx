import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReasonDialog } from '../components/Modal';

describe('Moderation reason dialog', () => {
  it('blocks confirmation when a reason is required but empty', async () => {
    const onConfirm = vi.fn();
    render(
      <ReasonDialog
        open
        title="Reject listing"
        message="This listing will be rejected."
        requireReason
        confirmLabel="Reject"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('A reason is required');
  });

  it('blocks confirmation when the reason is too short', async () => {
    const onConfirm = vi.fn();
    render(
      <ReasonDialog open title="Suspend user" requireReason onConfirm={onConfirm} onCancel={() => {}} />,
    );

    await userEvent.type(screen.getByLabelText(/reason/i), 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('A reason is required');
  });

  it('confirms with the trimmed reason once valid', async () => {
    const onConfirm = vi.fn();
    render(
      <ReasonDialog
        open
        title="Reject listing"
        requireReason
        confirmLabel="Reject"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText(/reason/i), '  Prices are misleading  ');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Prices are misleading');
  });

  it('allows an empty optional reason (e.g. user reactivate)', async () => {
    const onConfirm = vi.fn();
    render(
      <ReasonDialog open title="Reactivate account" onConfirm={onConfirm} onCancel={() => {}} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
