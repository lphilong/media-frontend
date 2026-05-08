import type { Resource } from 'i18next';

const localeFiles = import.meta.glob('../../locales/*/*.json', {
  eager: true,
}) as Record<string, { default: Record<string, unknown> }>;

const resources = Object.entries(localeFiles).reduce<Resource>((acc, [path, module]) => {
  const match = path.match(/locales\/(.+?)\/(.+?)\.json$/);

  if (!match) {
    return acc;
  }

  const [, locale, namespace] = match;
  if (!acc[locale]) {
    acc[locale] = {};
  }

  acc[locale][namespace] = module.default;
  return acc;
}, {});

export { resources };
