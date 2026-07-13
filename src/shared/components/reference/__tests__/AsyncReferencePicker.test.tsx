import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import {
  AsyncReferencePicker,
  EmploymentProfileReferencePicker,
  OrgUnitReferencePicker,
  PlatformAccountReferencePicker,
  ReferenceFilterField,
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

  afterEach(() => {
    vi.useRealTimers();
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
    await user.click(screen.getByRole('option', { name: /Talent 01/i }));

    expect(onChange).toHaveBeenCalledWith('talent-01');
  });

  it('renders primary labels with secondary metadata and optional badges', async () => {
    const loadOptions = vi.fn(async () => {
      return [
        {
          id: 'profile-01',
          label: 'Nguyen Van A',
          description: 'Operations lead',
          code: 'EMP-001',
          status: 'ACTIVE',
          badges: [{ label: 'Internal', tone: 'info' as const }],
        },
      ];
    });

    render(
      <AsyncReferencePicker
        pickerId="employment-profile"
        onChange={vi.fn()}
        loadOptions={loadOptions}
      />,
    );

    expect(await screen.findByRole('option', { name: /Nguyen Van A/i })).toBeInTheDocument();
    expect(screen.getByText(/Operations lead/u)).toBeInTheDocument();
    expect(screen.getByText(/Code: EMP-001/u)).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Internal')).toBeInTheDocument();
  });

  it('deduplicates identical semantic badges without duplicate React keys', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <AsyncReferencePicker
        pickerId="deduplicated-badges"
        onChange={vi.fn()}
        loadOptions={vi.fn(async () => [
          {
            id: 'profile-01',
            label: 'Profile 01',
            badges: [
              { label: 'Internal', tone: 'info' as const },
              { label: 'Internal', tone: 'info' as const },
            ],
          },
        ])}
      />,
    );

    expect(await screen.findByRole('option', { name: /Profile 01/i })).toBeInTheDocument();
    expect(screen.getAllByText('Internal')).toHaveLength(1);
    expect(consoleError.mock.calls.some((call) => String(call[0]).includes('same key'))).toBe(
      false,
    );
    consoleError.mockRestore();
  });

  it('keeps same-label badges from different semantic sources distinct', async () => {
    render(
      <AsyncReferencePicker
        pickerId="semantic-badges"
        onChange={vi.fn()}
        loadOptions={vi.fn(async () => [
          {
            id: 'profile-01',
            label: 'Profile 01',
            status: 'ACTIVE',
            meta: { employmentStatus: 'ACTIVE' },
          },
        ])}
      />,
    );

    expect(await screen.findByRole('option', { name: /Profile 01/i })).toBeInTheDocument();
    expect(screen.getAllByText('ACTIVE')).toHaveLength(2);
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

  it('uses an explicit safe fallback when a selected option is absent from the result set', async () => {
    render(
      <AsyncReferencePicker
        pickerId="safe-fallback"
        onChange={vi.fn()}
        loadOptions={async () => []}
        value="3fa85f64-5717-4562-b3fc-2c963f66afa6"
        selectedLabelFallback="Selected record is unavailable"
      />,
    );

    expect(await screen.findByText('Selected record is unavailable')).toBeInTheDocument();
    expect(screen.queryByText('3fa85f64-5717-4562-b3fc-2c963f66afa6')).not.toBeInTheDocument();
  });

  it('renders loading state while options are being fetched', async () => {
    let resolveOptions: (options: Array<{ id: string; label: string }>) => void = () => {};
    const loadOptions = vi.fn(
      () =>
        new Promise<Array<{ id: string; label: string }>>((resolve) => {
          resolveOptions = resolve;
        }),
    );

    render(
      <AsyncReferencePicker
        pickerId="employment-profile"
        onChange={vi.fn()}
        loadOptions={loadOptions}
      />,
    );

    expect(await screen.findByText('Loading')).toBeInTheDocument();
    resolveOptions([]);
    await waitFor(() => {
      expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    });
  });

  it('renders a default empty state when no options match', async () => {
    render(
      <AsyncReferencePicker
        pickerId="talent"
        onChange={vi.fn()}
        loadOptions={vi.fn(async () => [])}
      />,
    );

    expect(await screen.findByText('No matching options')).toBeInTheDocument();
    expect(screen.getByText(/Try another search term/u)).toBeInTheDocument();
  });

  it('keeps selected context without clear UI when optional selection is not explicitly clearable', async () => {
    render(
      <MemoryRouter>
        <AsyncReferencePicker
          pickerId="talent"
          onChange={vi.fn()}
          loadOptions={vi.fn(async () => [
            {
              id: 'talent-01',
              label: 'Talent One',
              code: 'TL-001',
              href: '/talents/talent-01',
            },
          ])}
          value="talent-01"
          exactOneId={false}
          clearLabel="Clear talent"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Selected reference')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Talent One' })).toHaveAttribute(
      'href',
      '/talents/talent-01',
    );
    expect(screen.getAllByText(/Code: TL-001/u).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Clear talent' })).not.toBeInTheDocument();
  });

  it('keeps selected context clear and can clear explicitly clearable optional selections', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MemoryRouter>
        <AsyncReferencePicker
          pickerId="talent"
          onChange={onChange}
          loadOptions={vi.fn(async () => [
            {
              id: 'talent-01',
              label: 'Talent One',
              code: 'TL-001',
              href: '/talents/talent-01',
            },
          ])}
          value="talent-01"
          exactOneId={false}
          clearable
          clearLabel="Clear talent"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Selected reference')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Talent One' })).toHaveAttribute(
      'href',
      '/talents/talent-01',
    );
    expect(screen.getAllByText(/Code: TL-001/u).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Clear talent' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('debounces rapid search input before loading options', async () => {
    vi.useFakeTimers();
    const loadOptions = vi.fn(async () => []);

    render(
      <AsyncReferencePicker
        pickerId="talent"
        onChange={vi.fn()}
        loadOptions={loadOptions}
        value={undefined}
      />,
    );

    expect(loadOptions).toHaveBeenCalledTimes(1);
    expect(loadOptions).toHaveBeenLastCalledWith('', {
      signal: expect.any(AbortSignal),
    });
    loadOptions.mockClear();

    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });

    act(() => {
      vi.advanceTimersByTime(249);
    });

    expect(loadOptions).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(loadOptions).toHaveBeenCalledTimes(1);
    expect(loadOptions).toHaveBeenLastCalledWith('abc', {
      signal: expect.any(AbortSignal),
    });
  });

  it('rejects stale responses that resolve during the debounce window', async () => {
    vi.useFakeTimers();
    let resolveOld: (options: Array<{ id: string; label: string }>) => void = () => {};
    let resolveNew: (options: Array<{ id: string; label: string }>) => void = () => {};
    let oldSignal: AbortSignal | undefined;
    let newSignal: AbortSignal | undefined;
    const loadOptions = vi.fn(
      (search: string, context?: { signal: AbortSignal }) =>
        new Promise<Array<{ id: string; label: string }>>((resolve) => {
          if (search === '') {
            oldSignal = context?.signal;
            resolveOld = resolve;
            return;
          }

          newSignal = context?.signal;
          resolveNew = resolve;
        }),
    );

    render(
      <AsyncReferencePicker
        pickerId="talent"
        onChange={vi.fn()}
        loadOptions={loadOptions}
        value={undefined}
      />,
    );

    expect(loadOptions).toHaveBeenCalledTimes(1);
    expect(oldSignal?.aborted).toBe(false);

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'new' } });

    expect(oldSignal?.aborted).toBe(true);

    await act(async () => {
      resolveOld([{ id: 'old', label: 'Old result' }]);
    });

    expect(screen.queryByText('Old result')).not.toBeInTheDocument();
    expect(loadOptions).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(loadOptions).toHaveBeenCalledTimes(2);
    expect(loadOptions).toHaveBeenLastCalledWith('new', {
      signal: expect.any(AbortSignal),
    });
    expect(newSignal?.aborted).toBe(false);

    await act(async () => {
      resolveNew([{ id: 'new', label: 'New result' }]);
    });

    expect(screen.getByText('New result')).toBeInTheDocument();
    expect(screen.queryByText('Old result')).not.toBeInTheDocument();
  });

  it('keeps stale responses from overwriting newer options', async () => {
    let resolveFirst: (options: Array<{ id: string; label: string }>) => void = () => {};
    let resolveSecond: (options: Array<{ id: string; label: string }>) => void = () => {};
    const loadOptions = vi.fn(
      (search: string) =>
        new Promise<Array<{ id: string; label: string }>>((resolve) => {
          if (search === 'first') {
            resolveFirst = resolve;
            return;
          }

          if (search === 'second') {
            resolveSecond = resolve;
            return;
          }

          resolve([]);
        }),
    );

    render(
      <AsyncReferencePicker
        pickerId="talent"
        onChange={vi.fn()}
        loadOptions={loadOptions}
        value={undefined}
        debounceMs={10_000}
      />,
    );

    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'first' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.change(input, { target: { value: 'second' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await act(async () => {
      resolveFirst([{ id: 'old', label: 'Old result' }]);
    });

    expect(screen.queryByText('Old result')).not.toBeInTheDocument();

    await act(async () => {
      resolveSecond([{ id: 'new', label: 'New result' }]);
    });

    expect(await screen.findByText('New result')).toBeInTheDocument();
    expect(screen.queryByText('Old result')).not.toBeInTheDocument();
  });

  it('aborts in-flight option loading on unmount', async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    const loadOptions = vi.fn(
      (_search: string, context?: { signal: AbortSignal }) =>
        new Promise<Array<{ id: string; label: string }>>(() => {
          observedSignal = context?.signal;
        }),
    );

    const { unmount } = render(
      <AsyncReferencePicker
        pickerId="talent"
        onChange={vi.fn()}
        loadOptions={loadOptions}
        value={undefined}
      />,
    );

    expect(observedSignal?.aborted).toBe(false);
    unmount();
    expect(observedSignal?.aborted).toBe(true);
  });

  it('renders compact inline load errors with retry instead of the shared ErrorState card', async () => {
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
        resourceLabel="Employment Profile"
        disabledSlot={<div>Disabled Slot</div>}
        emptySlot={<div>Empty Slot</div>}
      />,
    );

    expect(
      await screen.findByText('Could not load Employment Profile options.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load Employment Profile options.',
    );
    expect(screen.queryByText('Unexpected error')).not.toBeInTheDocument();
    expect(screen.queryByText('Please retry or reload the page')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Empty Slot')).toBeInTheDocument();
  });

  it('keeps filter reference load failures compact and local to the field', async () => {
    const loadOptions = vi.fn().mockRejectedValue(new Error('failed'));

    render(
      <ReferenceFilterField
        label="Talent"
        pickerId="talent-filter"
        value={undefined}
        loadOptions={loadOptions}
        onChange={vi.fn()}
        clearLabel="Clear"
      />,
    );

    expect(await screen.findByText('Could not load Talent options.')).toBeInTheDocument();
    expect(screen.queryByText('Unexpected error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('picker-surface')).toBeInTheDocument();
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
