import { EmploymentProfileCreateWorkflow } from '@modules/employment-profile/components/EmploymentProfileCreateWorkflow';
import { useCreateEmploymentProfileMutation } from '@modules/employment-profile/hooks/use-employment-profile';
import type { EmploymentProfileCreatePayload } from '@modules/employment-profile/types/employment-profile.types';
import {
  canShowAction,
  PERMISSIONS,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import { LoadingState, PageContainer, PermissionDeniedState } from '@shared/components/primitives';

export const EmploymentProfileCreatePage = (): JSX.Element => {
  const capabilitiesQuery = useCurrentActorCapabilities();
  const createMutation = useCreateEmploymentProfileMutation();

  if (capabilitiesQuery.isPending && !capabilitiesQuery.data) {
    return (
      <PageContainer>
        <LoadingState lines={6} />
      </PageContainer>
    );
  }

  if (
    !canShowAction(capabilitiesQuery.data, {
      permission: PERMISSIONS.EMPLOYMENT_PROFILE_CREATE,
    })
  ) {
    return (
      <PageContainer>
        <PermissionDeniedState />
      </PageContainer>
    );
  }

  const createProfile = (payload: EmploymentProfileCreatePayload) =>
    createMutation.mutateAsync(payload);

  return (
    <PageContainer className="space-y-5">
      <EmploymentProfileCreateWorkflow onSubmit={createProfile} />
    </PageContainer>
  );
};
