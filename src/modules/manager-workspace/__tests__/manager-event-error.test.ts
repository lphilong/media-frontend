import { z } from 'zod';

import { classifyManagerEventError } from '@modules/manager-workspace/manager-event-error';
import type { NormalizedApiError } from '@shared/api';

const normalizedError = (status: number | null): NormalizedApiError => ({
  status,
  code: status === null ? 'NETWORK' : `HTTP_${status}`,
  message: 'errors:transport.generic',
  fieldErrors: {},
  retryable: status === null || status >= 500,
  permissionDenied: status === 403,
  notFound: status === 404,
});

describe('Manager Event error classification', () => {
  it.each([
    [401, 'SESSION_FAILURE', false],
    [403, 'FORBIDDEN', false],
    [404, 'NOT_FOUND', false],
    [409, 'VALIDATION_CONFLICT', false],
    [422, 'VALIDATION_CONFLICT', false],
    [500, 'SERVER_FAILURE', true],
    [503, 'SERVER_FAILURE', true],
  ] as const)('classifies HTTP %s as %s', (status, kind, retryable) => {
    expect(classifyManagerEventError(normalizedError(status))).toMatchObject({ kind, retryable });
  });

  it('distinguishes network failures from malformed successful responses', () => {
    expect(classifyManagerEventError(normalizedError(null))).toMatchObject({
      kind: 'NETWORK_FAILURE',
      retryable: true,
    });

    const malformed = z.object({ id: z.string() }).safeParse({ id: 42 });
    expect(malformed.success).toBe(false);
    if (!malformed.success) {
      expect(classifyManagerEventError(malformed.error)).toMatchObject({
        kind: 'MALFORMED_RESPONSE',
        retryable: false,
        technicalDetails: { category: 'response-schema', issueCount: 1 },
      });
    }
  });

  it('keeps bounded transport details without backend messages', () => {
    expect(classifyManagerEventError(normalizedError(403)).technicalDetails).toEqual({
      category: 'request',
      status: 403,
      code: 'HTTP_403',
    });
  });
});
