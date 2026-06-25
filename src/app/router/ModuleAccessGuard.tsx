import type { PropsWithChildren } from 'react';

import { canAccessModule, type ModuleAccessModuleId } from '@app/router/module-access';
import { hasWorkspace, useCurrentActorCapabilities } from '@shared/auth/current-actor-capabilities';
import { LoadingState, PageContainer, PermissionDeniedState } from '@shared/components/primitives';

type ModuleAccessGuardProps = PropsWithChildren<{
  moduleId: ModuleAccessModuleId;
}>;

export const ModuleAccessGuard = ({ children, moduleId }: ModuleAccessGuardProps): JSX.Element => {
  const capabilitiesQuery = useCurrentActorCapabilities();

  if (capabilitiesQuery.isLoading && !capabilitiesQuery.data) {
    return (
      <PageContainer>
        <LoadingState lines={5} />
      </PageContainer>
    );
  }

  if (
    capabilitiesQuery.isError ||
    !hasWorkspace(capabilitiesQuery.data, 'ADMIN_CONSOLE') ||
    !canAccessModule(capabilitiesQuery.data, moduleId)
  ) {
    return (
      <PageContainer>
        <PermissionDeniedState />
      </PageContainer>
    );
  }

  return <>{children}</>;
};
