import { renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { vi } from 'vitest';

import {
  MutationFieldErrorSummary,
  useMutationSurfaceLifecycle,
} from '@shared/modules/module-mutation-surface';
import { renderModuleMutationSurface } from '@shared/testing';

describe('module mutation surface', () => {
  it('keeps submit disabled when pending, read-only, or locked', () => {
    renderModuleMutationSurface({
      isPending: true,
      isReadOnly: true,
      isLocked: true,
      submitLabel: 'Save',
      pendingLabel: 'Saving',
      readOnlyNotice: <div>Read-only</div>,
      lockedNotice: <div>Locked</div>,
    });

    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('renders normalized field error summary consistently', () => {
    renderModuleMutationSurface({
      fieldErrorSummary: (
        <MutationFieldErrorSummary
          errors={{
            subjectTalentId: ['Required'],
            revenueEntryIds: ['Must include at least one id', 'Ids must be unique'],
          }}
        />
      ),
    });

    expect(screen.getByText('subjectTalentId')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('revenueEntryIds')).toBeInTheDocument();
    expect(screen.getByText('Must include at least one id')).toBeInTheDocument();
    expect(screen.getByText('Ids must be unique')).toBeInTheDocument();
  });

  it('runs submit and cancel handlers with shared action layout', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const onCancel = vi.fn();

    renderModuleMutationSurface({
      onSubmit,
      onCancel,
      submitLabel: 'Submit',
      cancelLabel: 'Cancel',
    });

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('provides reset/close integration through mutation lifecycle helper', () => {
    const onSuccess = vi.fn();
    const onReset = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useMutationSurfaceLifecycle<{ id: string }>({
        onSuccess,
        onReset,
        onClose,
        resetOnSuccess: true,
        closeOnSuccess: true,
      }),
    );

    result.current({ id: 'record-01' });

    expect(onSuccess).toHaveBeenCalledWith({ id: 'record-01' });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
