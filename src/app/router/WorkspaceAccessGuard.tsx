import type { PropsWithChildren } from 'react';

import {
  hasWorkspace,
  type AccountContext,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import { LoadingState, PageContainer, PermissionDeniedState } from '@shared/components/primitives';

type WorkspaceAccessGuardProps = PropsWithChildren<{
  workspace: AccountContext;
}>;

export const WorkspaceAccessGuard = ({
  children,
  workspace,
}: WorkspaceAccessGuardProps): JSX.Element => {
  const capabilitiesQuery = useCurrentActorCapabilities();

  if (capabilitiesQuery.isLoading && !capabilitiesQuery.data) {
    return (
      <PageContainer>
        <LoadingState lines={5} />
      </PageContainer>
    );
  }

  if (capabilitiesQuery.isError || !hasWorkspace(capabilitiesQuery.data, workspace)) {
    return (
      <PageContainer>
        <PermissionDeniedState />
      </PageContainer>
    );
  }

  return <>{children}</>;
};
