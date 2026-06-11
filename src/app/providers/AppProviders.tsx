import type { PropsWithChildren } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@app/providers/query-client';
import { AuthProvider } from '@shared/auth/auth-context';
import { ConfirmDialogProvider } from '@shared/components/primitives/ConfirmDialog';
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
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
