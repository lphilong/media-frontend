import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';

import { SensitiveActionDialog } from '@shared/components/primitives';

const dialogProps = {
  title: 'Confirm sensitive action',
  summary: 'This action changes a protected record.',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
};

const mockVisibleElements = (): (() => void) => {
  const getClientRects = vi
    .spyOn(HTMLElement.prototype, 'getClientRects')
    .mockImplementation(() => [{ width: 1, height: 1 }] as unknown as DOMRectList);

  return () => getClientRects.mockRestore();
};

const DialogTrigger = ({ onConfirm = vi.fn() }: { onConfirm?: () => void }): JSX.Element => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <SensitiveActionDialog
        {...dialogProps}
        open={open}
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
};

describe('SensitiveActionDialog focus behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves focus from its trigger into the dialog when opened', async () => {
    const user = userEvent.setup();
    render(<DialogTrigger />);

    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: dialogProps.title });
    expect(dialog).toHaveFocus();
    expect(trigger).not.toHaveFocus();
  });

  it('wraps forward and reverse keyboard focus across enabled dialog controls', async () => {
    const restoreVisibleElements = mockVisibleElements();
    const user = userEvent.setup();
    render(
      <SensitiveActionDialog
        {...dialogProps}
        open
        acknowledgementLabel="I understand the impact"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const acknowledgement = screen.getByRole('checkbox', { name: 'I understand the impact' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    await user.click(acknowledgement);

    confirm.focus();
    await user.tab();
    expect(acknowledgement).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    restoreVisibleElements();
  });

  it('excludes disabled controls and keeps focus in a submitting dialog with no enabled controls', async () => {
    const restoreVisibleElements = mockVisibleElements();
    const user = userEvent.setup();
    const { rerender } = render(
      <SensitiveActionDialog
        {...dialogProps}
        open
        acknowledgementLabel="I understand the impact"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: dialogProps.title });
    const acknowledgement = screen.getByRole('checkbox', { name: 'I understand the impact' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();

    dialog.focus();
    await user.tab();
    expect(acknowledgement).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(acknowledgement).toHaveFocus();

    rerender(
      <SensitiveActionDialog
        {...dialogProps}
        open
        isSubmitting
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const submittingDialog = screen.getByRole('dialog', { name: dialogProps.title });
    submittingDialog.focus();
    await user.tab();
    expect(submittingDialog).toHaveFocus();

    restoreVisibleElements();
  });

  it('returns focus to its trigger after cancel without confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DialogTrigger onConfirm={onConfirm} />);

    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('safely closes after its original trigger is removed and cleans up on unmount', () => {
    const onCancel = vi.fn();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    const { rerender, unmount } = render(
      <SensitiveActionDialog {...dialogProps} open onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    trigger.remove();
    expect(() =>
      rerender(
        <SensitiveActionDialog
          {...dialogProps}
          open={false}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      ),
    ).not.toThrow();
    expect(() => unmount()).not.toThrow();
  });
});
