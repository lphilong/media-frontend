import { ZodError } from 'zod';

import { normalizeApiError, type NormalizedApiError } from '@shared/api';

export type ManagerEventErrorKind =
  | 'SESSION_FAILURE'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_CONFLICT'
  | 'MALFORMED_RESPONSE'
  | 'NETWORK_FAILURE'
  | 'SERVER_FAILURE'
  | 'UNKNOWN_FAILURE';

export type ManagerEventErrorState = {
  kind: ManagerEventErrorKind;
  retryable: boolean;
  technicalDetails: Readonly<Record<string, string | number>>;
};

const isNormalizedApiError = (error: unknown): error is NormalizedApiError =>
  error !== null &&
  typeof error === 'object' &&
  'status' in error &&
  (typeof error.status === 'number' || error.status === null) &&
  'retryable' in error &&
  typeof error.retryable === 'boolean' &&
  'permissionDenied' in error &&
  typeof error.permissionDenied === 'boolean' &&
  'notFound' in error &&
  typeof error.notFound === 'boolean';

export const classifyManagerEventError = (error: unknown): ManagerEventErrorState => {
  if (error instanceof ZodError) {
    return {
      kind: 'MALFORMED_RESPONSE',
      retryable: false,
      technicalDetails: {
        category: 'response-schema',
        issueCount: error.issues.length,
      },
    };
  }

  // apiRequest already normalizes transport failures before React Query receives them.
  const normalized = isNormalizedApiError(error) ? error : normalizeApiError(error);
  const technicalDetails: Record<string, string | number> = {
    category: 'request',
    ...(normalized.status !== null ? { status: normalized.status } : {}),
    ...(normalized.code ? { code: normalized.code } : {}),
    ...(normalized.requestId ? { requestId: normalized.requestId } : {}),
  };

  if (normalized.status === 401) {
    return { kind: 'SESSION_FAILURE', retryable: false, technicalDetails };
  }
  if (normalized.status === 403) {
    return { kind: 'FORBIDDEN', retryable: false, technicalDetails };
  }
  if (normalized.status === 404) {
    return { kind: 'NOT_FOUND', retryable: false, technicalDetails };
  }
  if (normalized.status === 409 || normalized.status === 422) {
    return { kind: 'VALIDATION_CONFLICT', retryable: false, technicalDetails };
  }
  if (normalized.status !== null && normalized.status >= 500) {
    return { kind: 'SERVER_FAILURE', retryable: true, technicalDetails };
  }
  if (normalized.status === null) {
    return { kind: 'NETWORK_FAILURE', retryable: true, technicalDetails };
  }
  return {
    kind: 'UNKNOWN_FAILURE',
    retryable: normalized.retryable,
    technicalDetails,
  };
};
