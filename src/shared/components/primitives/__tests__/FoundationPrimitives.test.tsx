import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Check, X } from 'lucide-react';
import { vi } from 'vitest';

import {
  Button,
  getSemanticInteractionClasses,
  getSemanticToneClasses,
  isSemanticTone,
  SensitiveActionDialog,
  TechnicalDetailsDisclosure,
  WorkflowProgress,
} from '@shared/components/primitives';

describe('shared foundation primitives', () => {
  it('keeps semantic business tones separate from interaction state classes', () => {
    expect(isSemanticTone('critical')).toBe(true);
    expect(isSemanticTone('active')).toBe(false);
    expect(getSemanticToneClasses('critical').badge).toContain('bg-red-100');
    expect(getSemanticInteractionClasses({ active: true })).toContain('ring-2');
    expect(getSemanticInteractionClasses({ active: true })).not.toContain('bg-');
  });

  it('renders an accessible loading button without submitting forms by default', () => {
    render(
      <Button loading loadingLabel="Saving" leftIcon={<Check aria-hidden="true" />}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  it('renders button icons and variants from caller-owned content', () => {
    render(
      <Button variant="danger" rightIcon={<X data-testid="right-icon" aria-hidden="true" />}>
        Delete item
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Delete item' })).toHaveClass('bg-danger');
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('keeps technical details collapsed until the operator opens them', async () => {
    const user = userEvent.setup();

    render(
      <TechnicalDetailsDisclosure
        label="Technical details"
        details={{ backendCode: 'RAW_BACKEND_CODE', requestId: 'req-123' }}
      />,
    );

    expect(screen.queryByText(/RAW_BACKEND_CODE/u)).not.toBeVisible();

    await user.click(screen.getByText('Technical details'));

    expect(screen.getByText(/RAW_BACKEND_CODE/u)).toBeVisible();
  });

  it('requires caller-requested acknowledgement before confirming a sensitive action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <SensitiveActionDialog
        open
        title="Confirm sensitive action"
        summary="This action changes a protected record."
        riskItems={['Cannot be undone automatically', 'Requires audit review']}
        acknowledgementLabel="I understand the impact"
        confirmLabel="Apply action"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Confirm sensitive action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply action' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'I understand the impact' }));
    await user.click(screen.getByRole('button', { name: 'Apply action' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('renders workflow progress with active state overlay separate from business tone', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();

    render(
      <WorkflowProgress
        ariaLabel="Workflow steps"
        onItemSelect={onItemSelect}
        items={[
          {
            id: 'draft',
            title: 'Draft',
            summary: 'Ready',
            businessTone: 'success',
            isComplete: true,
          },
          {
            id: 'review',
            title: 'Review',
            summary: 'Needs attention',
            businessTone: 'warning',
            isActive: true,
          },
          {
            id: 'apply',
            title: 'Apply',
            summary: 'Unavailable',
            businessTone: 'danger',
            isDisabled: true,
          },
        ]}
      />,
    );

    const list = screen.getByRole('list', { name: 'Workflow steps' });
    expect(within(list).getByText('Draft').closest('li')).toHaveAttribute(
      'data-business-tone',
      'success',
    );
    expect(within(list).getByText('Review').closest('li')).toHaveAttribute(
      'data-business-tone',
      'warning',
    );
    expect(within(list).getByText('Review').closest('li')).toHaveAttribute('data-active', 'true');

    await user.click(screen.getByRole('button', { name: /Review/u }));
    expect(onItemSelect).toHaveBeenCalledWith('review');
    expect(screen.getByRole('button', { name: /Apply/u })).toBeDisabled();
  });
});
