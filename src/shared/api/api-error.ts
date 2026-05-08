import axios, { type AxiosError } from 'axios';

type SafeErrorDetailPrimitive = string | number | boolean | null;
type SafeErrorDetailValue = SafeErrorDetailPrimitive | SafeErrorDetailPrimitive[];

export type NormalizedApiError = {
  status: number | null;
  code?: string;
  message: string;
  fieldErrors: Record<string, string[]>;
  details?: Record<string, SafeErrorDetailValue>;
  requestId?: string;
  retryable: boolean;
  permissionDenied: boolean;
  notFound: boolean;
};

type BackendErrorPayload = {
  code?: unknown;
  message?: unknown;
  errors?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  meta?: unknown;
};

const SENSITIVE_DETAIL_KEY_PATTERN =
  /token|secret|password|authorization|cookie|credential|session|api[-_]?key|access[-_]?key|refresh|request(body)?|payload|body/iu;

const SENSITIVE_DETAIL_VALUE_PATTERN =
  /Bearer\s+[A-Za-z0-9._~+/-]+=*|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*|AKIA[0-9A-Z]{16}/u;

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
};

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const sanitizeDetailString = (value: string): string => {
  const normalized = value.trim();
  if (SENSITIVE_DETAIL_VALUE_PATTERN.test(normalized)) {
    return '[redacted]';
  }

  return normalized.length > 500 ? `${normalized.slice(0, 500)}...` : normalized;
};

const sanitizeDetailPrimitive = (value: unknown): SafeErrorDetailPrimitive | undefined => {
  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    return sanitizeDetailString(value);
  }

  return undefined;
};

const sanitizeDetailValue = (value: unknown): SafeErrorDetailValue | undefined => {
  if (Array.isArray(value)) {
    const sanitized = value
      .map((item) => sanitizeDetailPrimitive(item))
      .filter((item): item is SafeErrorDetailPrimitive => item !== undefined);

    return sanitized.length > 0 ? sanitized : undefined;
  }

  return sanitizeDetailPrimitive(value);
};

const sanitizeDetails = (details: unknown): Record<string, SafeErrorDetailValue> | undefined => {
  if (!isPlainRecord(details)) {
    return undefined;
  }

  const sanitized: Record<string, SafeErrorDetailValue> = {};

  Object.entries(details).forEach(([key, value]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey || SENSITIVE_DETAIL_KEY_PATTERN.test(normalizedKey)) {
      return;
    }

    const sanitizedValue = sanitizeDetailValue(value);
    if (sanitizedValue !== undefined) {
      sanitized[normalizedKey] = sanitizedValue;
    }
  });

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const normalizeFieldErrors = (errors: unknown): Record<string, string[]> => {
  if (!isPlainRecord(errors)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(errors)
      .map(([field, value]) => {
        const normalizedField = field.trim();
        if (!normalizedField || SENSITIVE_DETAIL_KEY_PATTERN.test(normalizedField)) {
          return null;
        }

        const rawMessages = Array.isArray(value) ? value : [value];
        const messages = rawMessages
          .map((item) => sanitizeDetailPrimitive(item))
          .filter((item): item is SafeErrorDetailPrimitive => item !== undefined)
          .map(String)
          .filter((item) => item.length > 0);

        return messages.length > 0 ? ([normalizedField, messages] as const) : null;
      })
      .filter((entry): entry is readonly [string, string[]] => entry !== null),
  );
};

const normalizeValidationDetailsAsFieldErrors = (
  status: number | null,
  code: string | undefined,
  details: Record<string, SafeErrorDetailValue> | undefined,
): Record<string, string[]> => {
  if (!details || (status !== 422 && !code?.includes('VALIDATION'))) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(details)
      .map(([field, value]) => {
        const rawMessages = Array.isArray(value) ? value : [value];
        const messages = rawMessages.map(String).filter((item) => item.length > 0);
        return messages.length > 0 ? ([field, messages] as const) : null;
      })
      .filter((entry): entry is readonly [string, string[]] => entry !== null),
  );
};

const readRequestId = (meta: unknown): string | undefined => {
  if (!isPlainRecord(meta)) {
    return undefined;
  }

  return asNonEmptyString(meta.requestId);
};

export const normalizeApiError = (error: unknown): NormalizedApiError => {
  if (!axios.isAxiosError(error)) {
    return {
      status: null,
      message: 'errors:transport.generic',
      fieldErrors: {},
      retryable: true,
      permissionDenied: false,
      notFound: false,
    };
  }

  const axiosError = error as AxiosError<BackendErrorPayload>;
  const status = axiosError.response?.status ?? null;
  const payload = axiosError.response?.data;
  const canonicalError = isPlainRecord(payload?.error) ? payload.error : undefined;
  const code = asNonEmptyString(canonicalError?.code) ?? asNonEmptyString(payload?.code);
  const details = sanitizeDetails(canonicalError?.details);
  const legacyFieldErrors = normalizeFieldErrors(payload?.errors);
  const validationFieldErrors = normalizeValidationDetailsAsFieldErrors(status, code, details);

  return {
    status,
    code,
    message:
      asNonEmptyString(canonicalError?.message) ??
      asNonEmptyString(payload?.message) ??
      'errors:transport.generic',
    fieldErrors: {
      ...validationFieldErrors,
      ...legacyFieldErrors,
    },
    ...(details ? { details } : {}),
    ...(readRequestId(payload?.meta) ? { requestId: readRequestId(payload?.meta) } : {}),
    retryable: status === null || status >= 500,
    permissionDenied: status === 401 || status === 403,
    notFound: status === 404,
  };
};
