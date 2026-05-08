import { render, screen, waitFor } from '@testing-library/react';

import { AppErrorBoundary } from '@app/providers/AppErrorBoundary';
import { setLocale } from '@shared/i18n/i18n';
import { setMonitoringReporter, type MonitoringEvent } from '@shared/monitoring';

const ThrowingChild = (): JSX.Element => {
  throw new Error('Boundary failed');
};

describe('AppErrorBoundary monitoring', () => {
  afterEach(() => {
    setMonitoringReporter(null);
    vi.restoreAllMocks();
  });

  it('reports sanitized boundary errors and renders fallback UI', async () => {
    await setLocale('en');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const events: MonitoringEvent[] = [];
    setMonitoringReporter((event) => {
      events.push(event);
    });

    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    );

    expect(await screen.findByText('Unexpected error')).toBeInTheDocument();
    await waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({
      category: 'react',
      routePath: '/',
      exceptionName: 'Error',
    });
    expect(JSON.stringify(events[0])).toContain('Boundary failed');
  });
});
