import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('employment-profile');
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
      <div>
        <h2 className="text-xl font-semibold text-text">{t('createWorkflow.pageTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('createWorkflow.pageSubtitle')}</p>
      </div>
      <EmploymentProfileCreateWorkflow onSubmit={createProfile} />
    </PageContainer>
  );
};
