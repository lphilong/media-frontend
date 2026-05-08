import '@testing-library/jest-dom/vitest';
import '@shared/i18n/i18n';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { queryClient } from '@app/providers/query-client';
import { usePageChromeStore } from '@app/store/page-chrome-store';
import { resetMockData } from '@test/msw/handlers';
import { server } from '@test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockData();
  queryClient.clear();
  usePageChromeStore.setState({ pageActions: null });
});
afterAll(() => server.close());
