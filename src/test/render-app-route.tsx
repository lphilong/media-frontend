import { useEffect, type ReactElement, type PropsWithChildren } from 'react';

import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';

import { AppProviders } from '@app/providers/AppProviders';
import { createAppQueryClient } from '@app/providers/query-client';
import { appRoutes } from '@app/router/router';
import { createFailClosedActorCapabilities } from '@test/factories/access';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';

type RenderAppWithProvidersOptions = {
  queryClient?: QueryClient;
};

type RenderRouteWithAccessOptions = RenderAppWithProvidersOptions & {
  capabilities?: Parameters<typeof setMockCurrentActorCapabilities>[0];
  initialEntries?: string[];
  routes?: RouteObject[];
};

type RenderModuleSurfaceOptions = RenderAppWithProvidersOptions & {
  routePath?: string;
};

const TestAppProviders = ({
  children,
  queryClient,
}: PropsWithChildren<{ queryClient: QueryClient }>): JSX.Element => {
  useEffect(() => {
    return () => {
      queryClient.clear();
    };
  }, [queryClient]);

  return <AppProviders queryClientInstance={queryClient}>{children}</AppProviders>;
};

export const renderAppWithProviders = (
  ui: ReactElement,
  options?: RenderAppWithProvidersOptions,
) => {
  const queryClient = options?.queryClient ?? createAppQueryClient();

  return {
    queryClient,
    ...render(<TestAppProviders queryClient={queryClient}>{ui}</TestAppProviders>),
  };
};

export const renderWithProviders = renderAppWithProviders;

export const renderRouteWithAccess = (path: string, options: RenderRouteWithAccessOptions = {}) => {
  setMockCurrentActorCapabilities(options.capabilities ?? createFailClosedActorCapabilities());

  const router = createMemoryRouter(options.routes ?? appRoutes, {
    initialEntries: options.initialEntries ?? [path],
  });

  return {
    router,
    ...renderAppWithProviders(<RouterProvider router={router} />, options),
  };
};

export const renderModuleSurface = (ui: ReactElement, options: RenderModuleSurfaceOptions = {}) =>
  renderAppWithProviders(
    <MemoryRouter initialEntries={[options.routePath ?? '/']}>{ui}</MemoryRouter>,
    options,
  );
