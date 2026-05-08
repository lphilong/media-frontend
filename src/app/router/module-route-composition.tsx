import type { RouteObject } from 'react-router-dom';

import type { ModuleRouteDefinition } from '@app/router/module-definitions';

export type ModuleRouteHandle = {
  breadcrumbKey?: string;
  titleKey?: string;
  subtitleKey?: string;
  stubRoute?: boolean;
};

const trimLeadingSlash = (path: string): string => path.replace(/^\//, '');

const toDetailSegment = (definition: ModuleRouteDefinition): string | null => {
  if (!definition.detailPath) {
    return null;
  }

  const listPrefix = `${definition.listPath}/`;
  if (!definition.detailPath.startsWith(listPrefix)) {
    return null;
  }

  return definition.detailPath.slice(listPrefix.length);
};

const toChildPath = (parentPath: string, fullPath: string): string => {
  const prefix = `${parentPath}/`;
  if (fullPath.startsWith(prefix)) {
    return fullPath.slice(prefix.length);
  }

  return trimLeadingSlash(fullPath);
};

type CreateStubModuleRouteOptions = {
  definition: ModuleRouteDefinition;
  listElement: JSX.Element;
  detailElement?: JSX.Element;
  stubRoute?: boolean;
};

export const createStubModuleBranchRoute = ({
  definition,
  listElement,
  detailElement,
  stubRoute = true,
}: CreateStubModuleRouteOptions): RouteObject => {
  const detailSegment = toDetailSegment(definition);

  return {
    path: trimLeadingSlash(definition.listPath),
    handle: {
      breadcrumbKey: `nav:items.${definition.navItemKey}`,
    } satisfies ModuleRouteHandle,
    children: [
      {
        index: true,
        element: listElement,
        handle: {
          titleKey: definition.listTitleKey,
          subtitleKey: definition.listSubtitleKey,
          stubRoute,
        } satisfies ModuleRouteHandle,
      },
      ...(detailSegment && detailElement
        ? [
            {
              path: detailSegment,
              element: detailElement,
              handle: {
                breadcrumbKey: 'common:labels.detail',
                titleKey: definition.detailTitleKey ?? definition.listTitleKey,
                subtitleKey: definition.detailSubtitleKey ?? definition.listSubtitleKey,
                stubRoute,
              } satisfies ModuleRouteHandle,
            },
          ]
        : []),
    ],
  };
};

type CreateStubCommissionRouteOptions = {
  definition: ModuleRouteDefinition;
  commissionPath: string;
  listElement: JSX.Element;
  detailElement?: JSX.Element;
  stubRoute?: boolean;
};

export const createStubCommissionBranchRoute = ({
  definition,
  commissionPath,
  listElement,
  detailElement,
  stubRoute = true,
}: CreateStubCommissionRouteOptions): RouteObject => {
  const detailSegment = toDetailSegment(definition);

  return {
    path: toChildPath(commissionPath, definition.listPath),
    handle: {
      breadcrumbKey: `nav:items.${definition.navItemKey}`,
    } satisfies ModuleRouteHandle,
    children: [
      {
        index: true,
        element: listElement,
        handle: {
          titleKey: definition.listTitleKey,
          subtitleKey: definition.listSubtitleKey,
          stubRoute,
        } satisfies ModuleRouteHandle,
      },
      ...(detailSegment && detailElement
        ? [
            {
              path: detailSegment,
              element: detailElement,
              handle: {
                breadcrumbKey: 'common:labels.detail',
                titleKey: definition.detailTitleKey ?? definition.listTitleKey,
                subtitleKey: definition.detailSubtitleKey ?? definition.listSubtitleKey,
                stubRoute,
              } satisfies ModuleRouteHandle,
            },
          ]
        : []),
    ],
  };
};
