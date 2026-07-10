import type { PropsWithChildren } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@app/providers/query-client';
import { adminReferenceLoaders } from '@app/registries/admin-reference-options';
import { AuthProvider } from '@shared/auth/auth-context';
import { ConfirmDialogProvider } from '@shared/components/primitives/ConfirmDialog';
import { ReferenceRegistryProvider } from '@shared/components/reference';
import { ToastProvider } from '@shared/components/primitives/ToastHost';

type AppProvidersProps = PropsWithChildren<{
  queryClientInstance?: QueryClient;
}>;

export const AppProviders = ({
  children,
  queryClientInstance = queryClient,
}: AppProvidersProps): JSX.Element => {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <ReferenceRegistryProvider registry={adminReferenceLoaders}>
              {children}
            </ReferenceRegistryProvider>
          </ConfirmDialogProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
