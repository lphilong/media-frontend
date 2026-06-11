import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from '@shared/components/primitives/ToastHost';

const ToastTrigger = (): JSX.Element => {
  const { pushToast } = useToast();

  return (
    <div>
      <button type="button" onClick={() => pushToast('Saved', 'success')}>
        Show toast
      </button>
      <button type="button" onClick={() => pushToast('Loaded bounded results', 'neutral')}>
        Show neutral toast
      </button>
    </div>
  );
};

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clears auto-dismiss timers on unmount', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    const { unmount } = render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    expect(screen.getByText('Saved')).toBeInTheDocument();

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('renders neutral toast feedback as a status', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show neutral toast' }));

    expect(screen.getByRole('status')).toHaveTextContent('Loaded bounded results');
  });
});
