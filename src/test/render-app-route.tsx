import { useEffect, type ReactElement, type PropsWithChildren } from 'react';

import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';

import { AppProviders } from '@app/providers/AppProviders';
import { createAppQueryClient } from '@app/providers/query-client';

type RenderAppWithProvidersOptions = {
  queryClient?: QueryClient;
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
