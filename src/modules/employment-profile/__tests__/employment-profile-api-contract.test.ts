import { http, HttpResponse } from 'msw';

import {
  fetchEmploymentProfileDirectReports,
  fetchEmploymentProfileDetail,
  fetchEmploymentProfiles,
} from '@modules/employment-profile/api/employment-profile.api';
import { server } from '@test/msw/server';

describe('Employment Profile API contract compatibility', () => {
  it('emits uppercase sortDirection for Employment Profile list requests', async () => {
    let observedSortDirection: string | null = null;

    server.use(
      http.get('*/admin/employment-profiles', ({ request }) => {
        observedSortDirection = new URL(request.url).searchParams.get('sortDirection');

        return HttpResponse.json({
          data: [],
          meta: {},
        });
      }),
    );

    await fetchEmploymentProfiles({
      sortBy: 'employeeCode',
      sortDirection: 'asc',
    });

    expect(observedSortDirection).toBe('ASC');
  });

  it('emits uppercase sortDirection for Employment Profile direct-reports requests', async () => {
    let observedSortDirection: string | null = null;

    server.use(
      http.get('*/admin/employment-profiles/:employmentProfileId/direct-reports', ({ request }) => {
        observedSortDirection = new URL(request.url).searchParams.get('sortDirection');

        return HttpResponse.json({
          data: [],
          meta: {},
        });
      }),
    );

    await fetchEmploymentProfileDirectReports('ep-001', {
      sortBy: 'displayName',
      sortDirection: 'desc',
    });

    expect(observedSortDirection).toBe('DESC');
  });

  it('accepts numeric UTC-midnight employment dates in detail responses', async () => {
    const employmentStartDate = Date.UTC(2026, 0, 1);
    const employmentEndDate = Date.UTC(2026, 3, 22);
    const hiredAt = Date.UTC(2026, 0, 2);
    const onboardedAt = Date.UTC(2026, 0, 8);

    server.use(
      http.get('*/admin/employment-profiles/:employmentProfileId', () => {
        return HttpResponse.json({
          data: {
            id: 'ep-001',
            employeeCode: 'EP-000001',
            legalName: 'Alice Nguyen',
            displayName: 'Alice',
            employmentKind: 'EMPLOYEE',
            jobTitle: 'Director',
            titleDescription: null,
            externalRef: null,
            orgUnitId: 'ou-sales',
            managerEmploymentProfileId: null,
            recruiterEmploymentProfileId: 'ep-recruiter',
            recruiterEmploymentProfileRef: {
              id: 'ep-recruiter',
              code: 'EP-REC',
              displayName: 'Recruiter Display',
              name: 'Recruiter Legal',
              status: 'ACTIVE',
            },
            hrOwnerEmploymentProfileId: 'ep-hr',
            hrOwnerEmploymentProfileRef: {
              id: 'ep-hr',
              code: 'EP-HR',
              displayName: 'HR Display',
              name: 'HR Legal',
              status: 'ACTIVE',
            },
            onboardingOwnerEmploymentProfileId: 'ep-onboarding',
            onboardingOwnerEmploymentProfileRef: {
              id: 'ep-onboarding',
              code: 'EP-ONB',
              displayName: 'Onboarding Display',
              name: 'Onboarding Legal',
              status: 'ACTIVE',
            },
            sourcedByEmploymentProfileId: null,
            sourcedByEmploymentProfileRef: null,
            linkedUserId: null,
            employmentStatus: 'TERMINATED',
            contractStatus: 'TERMINATED',
            employmentStartDate,
            employmentEndDate,
            hiredAt,
            onboardedAt,
            createdAt: Date.UTC(2026, 0, 1, 1),
            updatedAt: Date.UTC(2026, 3, 22, 1),
          },
        });
      }),
    );

    await expect(fetchEmploymentProfileDetail('ep-001')).resolves.toMatchObject({
      employmentStartDate,
      employmentEndDate,
      recruiterEmploymentProfileId: 'ep-recruiter',
      recruiterEmploymentProfileRef: expect.objectContaining({
        displayName: 'Recruiter Display',
      }),
      sourcedByEmploymentProfileId: null,
      hiredAt,
      onboardedAt,
    });
  });

  it('rejects non-midnight numeric employment dates in detail responses', async () => {
    server.use(
      http.get('*/admin/employment-profiles/:employmentProfileId', () => {
        return HttpResponse.json({
          data: {
            id: 'ep-001',
            employeeCode: 'EP-000001',
            legalName: 'Alice Nguyen',
            displayName: 'Alice',
            employmentKind: 'EMPLOYEE',
            jobTitle: 'Director',
            titleDescription: null,
            externalRef: null,
            orgUnitId: 'ou-sales',
            managerEmploymentProfileId: null,
            linkedUserId: null,
            employmentStatus: 'ACTIVE',
            contractStatus: 'ACTIVE',
            employmentStartDate: Date.UTC(2026, 0, 1, 1),
            employmentEndDate: null,
            createdAt: Date.UTC(2026, 0, 1, 1),
            updatedAt: Date.UTC(2026, 0, 1, 1),
          },
        });
      }),
    );

    await expect(fetchEmploymentProfileDetail('ep-001')).rejects.toThrow();
  });
});
