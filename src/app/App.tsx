import { RouterProvider } from 'react-router-dom';

import { AppErrorBoundary } from '@app/providers/AppErrorBoundary';
import { AppProviders } from '@app/providers/AppProviders';
import { createAppRouter } from '@app/router/router';

const router = createAppRouter();

export const App = (): JSX.Element => {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  );
};
