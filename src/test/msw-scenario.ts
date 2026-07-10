import type { RequestHandler } from 'msw';

import { createFailClosedActorCapabilities } from '@test/factories/access';
import { resetMockData } from '@test/msw/handlers';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import { server } from '@test/msw/server';

export type MswScenario = {
  capabilities?: Parameters<typeof setMockCurrentActorCapabilities>[0];
  handlers?: readonly RequestHandler[];
  resetData?: boolean;
};

export const setupMswScenario = ({
  capabilities,
  handlers = [],
  resetData = true,
}: MswScenario = {}): void => {
  if (resetData) {
    resetMockData();
  }

  setMockCurrentActorCapabilities(capabilities ?? createFailClosedActorCapabilities());

  if (handlers.length > 0) {
    server.use(...handlers);
  }
};
