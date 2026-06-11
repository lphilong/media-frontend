import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ModalHostProvider, useModalHost } from '@shared/components/primitives/ModalHost';

const ModalHarness = ({ onDismiss }: { onDismiss: () => void }): JSX.Element => {
  const { openDrawer } = useModalHost();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          openDrawer({
            title: 'Create record',
            content: <div>Drawer content</div>,
            onDismiss: () => {
              setIsOpen(false);
              onDismiss();
            },
          });
        }}
      >
        {isOpen ? 'Close create' : 'Open create'}
      </button>
    </div>
  );
};

describe('ModalHostProvider', () => {
  it('notifies the owner when the host close button dismisses the drawer', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(
      <ModalHostProvider>
        <ModalHarness onDismiss={onDismiss} />
      </ModalHostProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open create' }));
    const dialog = screen.getByRole('dialog', { name: 'Create record' });

    await user.click(within(dialog).getByRole('button'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Open create' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Create record' })).not.toBeInTheDocument();
  });
});
