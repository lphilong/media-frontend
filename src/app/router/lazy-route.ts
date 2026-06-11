import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load module script/i,
  /loading chunk \d+ failed/i,
  /chunkloaderror/i,
];

export type LazyRouteRetryOptions = {
  retries?: number;
  delayMs?: number;
};

export const isDynamicImportError = (error: unknown): boolean =>
  error instanceof Error &&
  DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(`${error.name}: ${error.message}`));

export const loadRouteModuleWithRetry = async <T>(
  importer: () => Promise<T>,
  options: LazyRouteRetryOptions = {},
): Promise<T> => {
  const retries = options.retries ?? 1;
  const delayMs = options.delayMs ?? 75;
  let attempt = 0;

  while (true) {
    try {
      return await importer();
    } catch (error) {
      if (!isDynamicImportError(error) || attempt >= retries) {
        throw error;
      }
      attempt += 1;
      if (delayMs > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
      }
    }
  }
};

// React's lazy type uses `any` here so it can preserve each component's exact props type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lazyRoute = <T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  options?: LazyRouteRetryOptions,
): LazyExoticComponent<T> => lazy(() => loadRouteModuleWithRetry(importer, options));
