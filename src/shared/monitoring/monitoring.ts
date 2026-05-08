import { env } from '@shared/config/env';
import type { NormalizedApiError } from '@shared/api';

export type MonitoringCategory = 'react' | 'api' | 'route' | 'unknown';

export type MonitoringContext = {
  category?: MonitoringCategory;
  status?: number | null;
  code?: string;
  routePath?: string;
  moduleSurface?: string;
};

export type MonitoringEvent = {
  category: MonitoringCategory;
  status?: number;
  code?: string;
  routePath?: string;
  moduleSurface?: string;
  exceptionName?: string;
  message?: string;
  appEnv?: string;
  buildLabel?: string;
};

export type MonitoringReporter = (event: MonitoringEvent) => void | Promise<void>;

const SECRET_PATTERN =
  /(bearer\s+[^\s,"']+|(?:access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|password|secret|client[_-]?secret|api[_-]?key|authsubject|raw[_-]?body|request[_-]?body|response[_-]?body)\s*[:=]\s*[^\s,"'}]+|access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|password|secret|client[_-]?secret|api[_-]?key|authsubject|raw[_-]?body|request[_-]?body|response[_-]?body)/gi;

let reporterOverride: MonitoringReporter | null = null;

const truncate = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;

const sanitizeText = (value: unknown, maxLength = 160): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/(raw[_-]?body|request[_-]?body|response[_-]?body)/i.test(trimmed)) {
    return '[redacted]';
  }

  return truncate(trimmed.replace(SECRET_PATTERN, '[redacted]'), maxLength);
};

const isNormalizedApiError = (error: unknown): error is NormalizedApiError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return 'fieldErrors' in error && 'retryable' in error && 'permissionDenied' in error;
};

const isTranslationKey = (value: string | undefined): boolean =>
  Boolean(value && /^[a-z0-9-]+:[a-z0-9_.-]+$/i.test(value));

export const sanitizeMonitoringEvent = (
  errorOrMessage: unknown,
  context: MonitoringContext = {},
): MonitoringEvent => {
  const event: MonitoringEvent = {
    category: context.category ?? 'unknown',
  };

  const status =
    context.status ?? (isNormalizedApiError(errorOrMessage) ? errorOrMessage.status : null);
  if (typeof status === 'number') {
    event.status = status;
  }

  const code =
    context.code ?? (isNormalizedApiError(errorOrMessage) ? errorOrMessage.code : undefined);
  const safeCode = sanitizeText(code, 80);
  if (safeCode) {
    event.code = safeCode;
  }

  const routePath = sanitizeText(context.routePath, 160);
  if (routePath) {
    event.routePath = routePath;
  }

  const moduleSurface = sanitizeText(context.moduleSurface, 80);
  if (moduleSurface) {
    event.moduleSurface = moduleSurface;
  }

  if (errorOrMessage instanceof Error) {
    event.exceptionName = sanitizeText(errorOrMessage.name, 80);
    event.message = sanitizeText(errorOrMessage.message);
  } else if (typeof errorOrMessage === 'string') {
    event.message = sanitizeText(errorOrMessage);
  } else if (isNormalizedApiError(errorOrMessage) && isTranslationKey(errorOrMessage.message)) {
    event.message = errorOrMessage.message;
  }

  const appEnv = sanitizeText(env.VITE_MONITORING_ENV || env.VITE_APP_ENV, 80);
  if (appEnv) {
    event.appEnv = appEnv;
  }

  const buildLabel = sanitizeText(env.VITE_BUILD_LABEL, 80);
  if (buildLabel) {
    event.buildLabel = buildLabel;
  }

  return event;
};

const browserReporter: MonitoringReporter = async (event) => {
  const endpoint = env.VITE_MONITORING_ENDPOINT?.trim();
  if (!endpoint) {
    return;
  }

  const body = JSON.stringify(event);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const sent = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    if (sent) {
      return;
    }
  }

  if (typeof fetch === 'function') {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    });
  }
};

const getReporter = (): MonitoringReporter => reporterOverride ?? browserReporter;

export const setMonitoringReporter = (reporter: MonitoringReporter | null): void => {
  reporterOverride = reporter;
};

export const captureError = (error: unknown, context?: MonitoringContext): void => {
  const event = sanitizeMonitoringEvent(error, context);

  try {
    void Promise.resolve(getReporter()(event)).catch(() => {
      // Monitoring must never become an app failure path.
    });
  } catch {
    // Monitoring must never become an app failure path.
  }
};

export const captureMessage = (message: string, context?: MonitoringContext): void => {
  captureError(message, context);
};
