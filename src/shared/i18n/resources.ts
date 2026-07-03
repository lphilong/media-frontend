import type { i18n as I18nInstance, Resource, ResourceKey } from 'i18next';

import {
  I18N_NAMESPACES,
  SUPPORTED_LOCALES,
  type AppLocale,
  type I18nNamespace,
} from '@shared/i18n/constants';

type LocaleJsonModule = {
  default: ResourceKey;
};

type LocaleNamespaceLoader = () => Promise<LocaleJsonModule>;

type LocaleResourceRegistry = Record<
  AppLocale,
  Partial<Record<I18nNamespace, LocaleNamespaceLoader>>
>;

const localeFiles = import.meta.glob<LocaleJsonModule>('../../locales/*/*.json');
const localePathPattern = /locales\/([^/]+)\/([^/]+)\.json$/;

const createEmptyRegistry = (): LocaleResourceRegistry => ({
  vi: {},
  en: {},
  zh: {},
});

const localeResourceRegistry = Object.entries(localeFiles).reduce<LocaleResourceRegistry>(
  (acc, [path, loader]) => {
    const match = path.match(localePathPattern);

    if (!match) {
      return acc;
    }

    const [, locale, namespace] = match;
    if (
      !SUPPORTED_LOCALES.includes(locale as AppLocale) ||
      !I18N_NAMESPACES.includes(namespace as I18nNamespace)
    ) {
      return acc;
    }

    acc[locale as AppLocale][namespace as I18nNamespace] = loader;
    return acc;
  },
  createEmptyRegistry(),
);

const loadedLocales = new Set<AppLocale>();
const loadingLocales = new Map<AppLocale, Promise<void>>();

const assertCompleteLocaleRegistry = (locale: AppLocale): void => {
  const missingNamespaces = I18N_NAMESPACES.filter(
    (namespace) => !localeResourceRegistry[locale][namespace],
  );

  if (missingNamespaces.length > 0) {
    throw new Error(`Missing locale resources for ${locale}: ${missingNamespaces.join(', ')}`);
  }
};

export const getLocaleResourcePaths = (): string[] => Object.keys(localeFiles).sort();

export const getLocaleNamespaces = (locale: AppLocale): I18nNamespace[] =>
  I18N_NAMESPACES.filter((namespace) => Boolean(localeResourceRegistry[locale][namespace]));

export const loadLocaleResources = async (
  i18nInstance: I18nInstance,
  locale: AppLocale,
): Promise<void> => {
  if (loadedLocales.has(locale)) {
    return;
  }

  const existingLoad = loadingLocales.get(locale);
  if (existingLoad) {
    await existingLoad;
    return;
  }

  assertCompleteLocaleRegistry(locale);

  const loadPromise = Promise.all(
    I18N_NAMESPACES.map(async (namespace) => {
      const loader = localeResourceRegistry[locale][namespace];
      if (!loader) {
        throw new Error(`Missing locale resource for ${locale}/${namespace}`);
      }

      const module = await loader();
      i18nInstance.addResourceBundle(locale, namespace, module.default, true, true);
    }),
  ).then(() => {
    loadedLocales.add(locale);
    loadingLocales.delete(locale);
  });

  loadingLocales.set(locale, loadPromise);
  await loadPromise;
};

export const loadLocaleResourceData = async (locale: AppLocale): Promise<Resource> => {
  assertCompleteLocaleRegistry(locale);

  const entries = await Promise.all(
    I18N_NAMESPACES.map(async (namespace) => {
      const loader = localeResourceRegistry[locale][namespace];
      if (!loader) {
        throw new Error(`Missing locale resource for ${locale}/${namespace}`);
      }

      const module = await loader();
      return [namespace, module.default] as const;
    }),
  );

  return {
    [locale]: Object.fromEntries(entries),
  };
};

export const loadAllLocaleResourceData = async (): Promise<Resource> => {
  const localeResources = await Promise.all(
    SUPPORTED_LOCALES.map(async (locale) => loadLocaleResourceData(locale)),
  );

  return localeResources.reduce<Resource>((acc, localeResource) => {
    return { ...acc, ...localeResource };
  }, {});
};
