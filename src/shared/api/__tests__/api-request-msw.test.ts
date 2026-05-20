import { http, HttpResponse } from 'msw';

import { normalizeApiError, type NormalizedApiError } from '@shared/api/api-error';
import { apiRequest } from '@shared/api/request';
import { setAccessTokenProvider } from '@shared/api/token-provider';
import { server } from '@test/msw/server';

describe('apiRequest', () => {
  afterEach(() => {
    setAccessTokenProvider(null);
  });

  it('uses the shared API seam for a successful MSW-backed request', async () => {
    setAccessTokenProvider(async () => 'foundation-smoke-token');

    server.use(
      http.get('*/foundation-smoke', ({ request }) => {
        return HttpResponse.json({
          ok: true,
          authorization: request.headers.get('authorization'),
        });
      }),
    );

    const response = await apiRequest<{ ok: boolean; authorization: string | null }>({
      method: 'GET',
      url: '/foundation-smoke',
    });

    expect(response).toEqual({
      ok: true,
      authorization: 'Bearer foundation-smoke-token',
    });
  });

  it.each([
    {
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid authentication',
      permissionDenied: true,
      notFound: false,
      retryable: false,
    },
    {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Permission denied',
      permissionDenied: true,
      notFound: false,
      retryable: false,
    },
    {
      status: 404,
      code: 'EMPLOYMENT_PROFILE_NOT_FOUND',
      message: 'Employment profile not found',
      permissionDenied: false,
      notFound: true,
      retryable: false,
    },
    {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
      permissionDenied: false,
      notFound: false,
      retryable: true,
    },
  ])(
    'normalizes backend canonical $status error envelopes',
    async ({ status, code, message, permissionDenied, notFound, retryable }) => {
      server.use(
        http.get(`*/canonical-error-${status}`, () => {
          return HttpResponse.json(
            {
              error: {
                code,
                message,
              },
              meta: {
                requestId: `req-${status}`,
              },
            },
            { status },
          );
        }),
      );

      await expect(
        apiRequest({
          method: 'GET',
          url: `/canonical-error-${status}`,
        }),
      ).rejects.toMatchObject({
        status,
        code,
        message,
        fieldErrors: {},
        requestId: `req-${status}`,
        retryable,
        permissionDenied,
        notFound,
      });
    },
  );

  it('normalizes backend canonical 422 validation details into field errors safely', async () => {
    server.use(
      http.post('*/canonical-validation-error', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: {
                legalName: ['Legal name is required'],
                jobTitle: 'Job title is required',
                requestBody: 'Bearer unsafe-token-value',
              },
            },
          },
          { status: 422 },
        );
      }),
    );

    try {
      await apiRequest({
        method: 'POST',
        url: '/canonical-validation-error',
        data: {},
      });
      throw new Error('Expected canonical validation request to fail');
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      expect(normalizedError).toMatchObject({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        fieldErrors: {
          legalName: ['Legal name is required'],
          jobTitle: ['Job title is required'],
        },
        details: {
          legalName: ['Legal name is required'],
          jobTitle: 'Job title is required',
        },
        retryable: false,
        permissionDenied: false,
        notFound: false,
      });
      expect(normalizedError.details).not.toHaveProperty('requestBody');
      expect(JSON.stringify(normalizedError)).not.toContain('unsafe-token-value');
    }
  });

  it('normalizes backend canonical conflict envelopes without requiring details', async () => {
    server.use(
      http.post('*/canonical-conflict-error', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'EMPLOYMENT_PROFILE_CONFLICT_ERROR',
              message: 'Employment profile conflict',
            },
          },
          { status: 409 },
        );
      }),
    );

    await expect(
      apiRequest({
        method: 'POST',
        url: '/canonical-conflict-error',
        data: {},
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'EMPLOYMENT_PROFILE_CONFLICT_ERROR',
      message: 'Employment profile conflict',
      fieldErrors: {},
      retryable: false,
      permissionDenied: false,
      notFound: false,
    });
  });

  it('keeps legacy root-style error envelopes compatible', async () => {
    server.use(
      http.patch('*/legacy-error', () => {
        return HttpResponse.json(
          {
            code: 'LEGACY_VALIDATION_ERROR',
            message: 'Legacy validation failed',
            errors: {
              title: ['Title is required'],
            },
          },
          { status: 422 },
        );
      }),
    );

    await expect(
      apiRequest({
        method: 'PATCH',
        url: '/legacy-error',
        data: {},
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'LEGACY_VALIDATION_ERROR',
      message: 'Legacy validation failed',
      fieldErrors: {
        title: ['Title is required'],
      },
      retryable: false,
      permissionDenied: false,
      notFound: false,
    });
  });

  it('keeps generic transport errors retryable', () => {
    expect(normalizeApiError(new Error('network unavailable'))).toEqual({
      status: null,
      message: 'errors:transport.generic',
      fieldErrors: {},
      retryable: true,
      permissionDenied: false,
      notFound: false,
    });
  });
});
