import { waitFor } from '@testing-library/react';

import {
  captureError,
  sanitizeMonitoringEvent,
  setMonitoringReporter,
  type MonitoringEvent,
} from '@shared/monitoring';

const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsText(blob);
  });

describe('monitoring seam', () => {
  afterEach(() => {
    setMonitoringReporter(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('is no-op when monitoring endpoint config is absent', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    captureError(new Error('render failed'), { category: 'react', routePath: '/dashboard' });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sanitizes tokens, secrets, raw bodies, and keeps safe diagnostic fields', () => {
    const event = sanitizeMonitoringEvent(
      new Error(
        'Request failed with Bearer abc.def password=plain accessToken=token123 rawBody={"x":1}',
      ),
      {
        category: 'api',
        status: 403,
        code: 'DASHBOARD_SCOPE_DENIED',
        routePath: '/dashboard',
        moduleSurface: 'dashboard-lite',
      },
    );

    const serialized = JSON.stringify(event);

    expect(event).toMatchObject({
      category: 'api',
      status: 403,
      code: 'DASHBOARD_SCOPE_DENIED',
      routePath: '/dashboard',
      moduleSurface: 'dashboard-lite',
      exceptionName: 'Error',
    });
    expect(serialized).not.toContain('abc.def');
    expect(serialized).not.toContain('plain');
    expect(serialized).not.toContain('token123');
    expect(serialized).not.toContain('{"x":1}');
    expect(serialized).toContain('[redacted]');
  });

  it('does not crash when the configured reporter fails', async () => {
    setMonitoringReporter(() => {
      throw new Error('reporter failed');
    });

    expect(() => captureError(new Error('render failed'), { category: 'react' })).not.toThrow();
  });

  it('supports a replaceable reporter adapter', async () => {
    const events: MonitoringEvent[] = [];
    setMonitoringReporter((event) => {
      events.push(event);
    });

    captureError(
      {
        status: 500,
        message: 'errors:transport.generic',
        fieldErrors: {},
        retryable: true,
        permissionDenied: false,
        notFound: false,
      },
      { category: 'api' },
    );

    await waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({
      category: 'api',
      status: 500,
      message: 'errors:transport.generic',
    });
  });

  it('sends sanitized payloads to the configured endpoint through sendBeacon when available', async () => {
    vi.stubEnv('VITE_MONITORING_ENDPOINT', 'https://monitoring.example.test/events');
    vi.stubEnv('VITE_MONITORING_ENV', 'uat');
    vi.stubEnv('VITE_BUILD_LABEL', 'uat-2026-04-30');
    const beaconSpy = vi.fn<(url: string | URL, data?: BodyInit | null) => boolean>(() => true);
    vi.stubGlobal('navigator', {
      ...navigator,
      sendBeacon: beaconSpy,
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const monitoring = await import('@shared/monitoring');

    monitoring.captureError(
      new Error('failed with Authorization: Bearer abc.def password=secret rawBody={"token":"x"}'),
      {
        category: 'api',
        status: 500,
        routePath: '/dashboard',
        moduleSurface: 'dashboard-lite',
      },
    );

    await waitFor(() => expect(beaconSpy).toHaveBeenCalledTimes(1));
    expect(beaconSpy).toHaveBeenCalledWith(
      'https://monitoring.example.test/events',
      expect.any(Blob),
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    const payloadData = beaconSpy.mock.calls[0]?.[1];
    expect(payloadData).toBeInstanceOf(Blob);
    const payloadBlob = payloadData as Blob;
    const payloadText = await readBlobText(payloadBlob);
    const payload = JSON.parse(payloadText) as MonitoringEvent;

    expect(payload).toMatchObject({
      category: 'api',
      status: 500,
      routePath: '/dashboard',
      moduleSurface: 'dashboard-lite',
      appEnv: 'uat',
      buildLabel: 'uat-2026-04-30',
    });
    expect(payloadText).not.toContain('abc.def');
    expect(payloadText).not.toContain('secret');
    expect(payloadText).not.toContain('{"token":"x"}');
    expect(payloadText).toContain('[redacted]');
  });

  it('falls back to fetch when sendBeacon is unavailable or declines the payload', async () => {
    vi.stubEnv('VITE_MONITORING_ENDPOINT', 'https://monitoring.example.test/events');
    const beaconSpy = vi.fn<(url: string | URL, data?: BodyInit | null) => boolean>(() => false);
    const fetchSpy = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('navigator', {
      ...navigator,
      sendBeacon: beaconSpy,
    });
    vi.stubGlobal('fetch', fetchSpy);
    const monitoring = await import('@shared/monitoring');

    monitoring.captureError(new Error('fetch fallback clientSecret=abc123'), {
      category: 'react',
      routePath: '/roles',
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(beaconSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://monitoring.example.test/events',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }),
    );

    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = String(requestInit.body);
    expect(body).toContain('"category":"react"');
    expect(body).not.toContain('abc123');
    expect(body).toContain('[redacted]');
  });

  it('isolates configured endpoint transport failures from the app path', async () => {
    vi.stubEnv('VITE_MONITORING_ENDPOINT', 'https://monitoring.example.test/events');
    const fetchSpy = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      () => Promise.reject(new Error('network down')),
    );
    vi.stubGlobal('navigator', {
      ...navigator,
      sendBeacon: undefined,
    });
    vi.stubGlobal('fetch', fetchSpy);
    const monitoring = await import('@shared/monitoring');

    expect(() =>
      monitoring.captureError(new Error('render failed'), { category: 'react' }),
    ).not.toThrow();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });
});
