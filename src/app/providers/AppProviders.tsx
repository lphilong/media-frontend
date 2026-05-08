import type { PropsWithChildren } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@app/providers/query-client';
import { AuthProvider } from '@shared/auth/auth-context';
import { ConfirmDialogProvider } from '@shared/components/primitives/ConfirmDialog';
import { ModalHostProvider } from '@shared/components/primitives/ModalHost';
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
            <ModalHostProvider>{children}</ModalHostProvider>
          </ConfirmDialogProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
