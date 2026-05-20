import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ActionRail } from '@shared/components/primitives/ActionRail';

describe('ActionRail', () => {
  it('renders disabledReason accessibly for disabled actions', () => {
    render(
      <ActionRail
        title="Actions"
        items={[
          {
            id: 'edit',
            label: 'Edit',
            disabled: true,
            disabledReason: 'You do not have permission to perform this action.',
            onClick: () => undefined,
          },
        ]}
      />,
    );

    const button = screen.getByRole('button', { name: 'Edit' });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      'You do not have permission to perform this action.',
    );
    expect(
      screen.getByText('You do not have permission to perform this action.'),
    ).toBeInTheDocument();
  });

  it('keeps enabled actions clickable and does not require a disabled reason', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <ActionRail
        title="Actions"
        items={[
          {
            id: 'edit',
            label: 'Edit',
            onClick,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
