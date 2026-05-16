import { http, HttpResponse } from 'msw';

import {
  fetchEmploymentProfileDirectReports,
  fetchEmploymentProfiles,
} from '@modules/employment-profile/api/employment-profile.api';
import { server } from '@test/msw/server';

describe('Employment Profile API contract compatibility', () => {
  it('emits uppercase sortDirection for Employment Profile list requests', async () => {
    let observedSortDirection: string | null = null;

    server.use(
      http.get('http://localhost:3000/admin/employment-profiles', ({ request }) => {
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
      http.get(
        'http://localhost:3000/admin/employment-profiles/:employmentProfileId/direct-reports',
        ({ request }) => {
          observedSortDirection = new URL(request.url).searchParams.get('sortDirection');

          return HttpResponse.json({
            data: [],
            meta: {},
          });
        },
      ),
    );

    await fetchEmploymentProfileDirectReports('ep-001', {
      sortBy: 'displayName',
      sortDirection: 'desc',
    });

    expect(observedSortDirection).toBe('DESC');
  });
});
