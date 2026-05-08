import { useState } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ConfirmDialogProvider,
  useConfirmDialog,
} from '@shared/components/primitives/ConfirmDialog';

const ConfirmDialogHarness = (): JSX.Element => {
  const { confirm } = useConfirmDialog();
  const [result, setResult] = useState('pending');

  const openDialog = async (): Promise<void> => {
    const didConfirm = await confirm({
      title: 'Foundation confirmation',
      description: 'Confirm primitive smoke test',
      confirmLabel: 'Apply',
      cancelLabel: 'Dismiss',
    });

    setResult(didConfirm ? 'confirmed' : 'cancelled');
  };

  return (
    <>
      <button type="button" onClick={() => void openDialog()}>
        Open confirmation
      </button>
      <output>{result}</output>
    </>
  );
};

describe('ConfirmDialogProvider', () => {
  it('opens through the shared confirmation seam and resolves cancel/confirm choices', async () => {
    const user = userEvent.setup();

    render(
      <ConfirmDialogProvider>
        <ConfirmDialogHarness />
      </ConfirmDialogProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
    expect(screen.getByRole('heading', { name: 'Foundation confirmation' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(await screen.findByText('cancelled')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('confirmed')).toBeInTheDocument();
  });
});
