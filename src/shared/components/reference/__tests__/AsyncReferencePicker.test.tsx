import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import {
  AsyncReferencePicker,
  EmploymentProfileReferencePicker,
  OrgUnitReferencePicker,
  PlatformAccountReferencePicker,
  StudioResourceReferencePicker,
  TalentGroupReferencePicker,
  TalentReferencePicker,
  UserReferencePicker,
} from '@shared/components/reference';
import { setLocale } from '@shared/i18n/i18n';

describe('AsyncReferencePicker', () => {
  beforeEach(async () => {
    await setLocale('en');
  });

  it('supports async option loading and exact-one-id selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const loadOptions = vi.fn(async () => {
      return [
        {
          id: 'talent-01',
          label: 'Talent 01',
          description: 'Primary talent',
        },
      ];
    });

    render(
      <AsyncReferencePicker
        pickerId="talent"
        onChange={onChange}
        loadOptions={loadOptions}
        value={undefined}
      />,
    );

    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(screen.getByRole('button', { name: /Talent 01/i }));

    expect(onChange).toHaveBeenCalledWith('talent-01');
  });

  it('renders safe plain-text fallback for selected value without href', async () => {
    const loadOptions = vi.fn(async () => {
      return [
        {
          id: 'org-01',
          label: 'ORG-01',
        },
      ];
    });

    render(
      <AsyncReferencePicker
        pickerId="org-unit"
        onChange={vi.fn()}
        loadOptions={loadOptions}
        value="org-01"
      />,
    );

    expect(await screen.findAllByText('ORG-01')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'ORG-01' })).not.toBeInTheDocument();
  });

  it('supports disabled, empty, and error slots', async () => {
    const user = userEvent.setup();
    const loadOptions = vi
      .fn(async (): Promise<Array<{ id: string; label: string }>> => [])
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce([]);

    render(
      <AsyncReferencePicker
        pickerId="employment-profile"
        onChange={vi.fn()}
        loadOptions={loadOptions}
        disabledSlot={<div>Disabled Slot</div>}
        emptySlot={<div>Empty Slot</div>}
      />,
    );

    expect(await screen.findByText('Please retry or reload the page')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Empty Slot')).toBeInTheDocument();
  });

  it('provides wrapper-friendly entity picker scaffolds for future module-specific pickers', () => {
    const sharedProps = {
      loadOptions: vi.fn(async () => []),
      onChange: vi.fn(),
      value: undefined,
      disabled: true,
      disabledSlot: <div>Disabled</div>,
    } as const;

    const { rerender } = render(<OrgUnitReferencePicker {...sharedProps} />);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.getByTestId('picker-surface')).toHaveAttribute('data-picker-id', 'org-unit');

    rerender(<EmploymentProfileReferencePicker {...sharedProps} />);
    expect(screen.getByTestId('picker-surface')).toHaveAttribute(
      'data-picker-id',
      'employment-profile',
    );

    rerender(<TalentReferencePicker {...sharedProps} />);
    expect(screen.getByTestId('picker-surface')).toHaveAttribute('data-picker-id', 'talent');

    rerender(<TalentGroupReferencePicker {...sharedProps} />);
    expect(screen.getByTestId('picker-surface')).toHaveAttribute('data-picker-id', 'talent-group');

    rerender(<PlatformAccountReferencePicker {...sharedProps} />);
    expect(screen.getByTestId('picker-surface')).toHaveAttribute(
      'data-picker-id',
      'platform-account',
    );

    rerender(<StudioResourceReferencePicker {...sharedProps} />);
    expect(screen.getByTestId('picker-surface')).toHaveAttribute(
      'data-picker-id',
      'studio-resource',
    );

    rerender(<UserReferencePicker {...sharedProps} />);
    expect(screen.getByTestId('picker-surface')).toHaveAttribute('data-picker-id', 'user');
  });
});
