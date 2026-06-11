import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import {
  parsePeopleReadinessIssueListResponse,
  type PeopleReadinessIssue,
} from '@modules/people-readiness/api/people-readiness.api';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import {
  peopleReadinessRequestLog,
  setPeopleReadinessIssues,
} from '@test/msw/people-readiness-handlers';
import { server } from '@test/msw/server';
import { renderAppWithProviders } from '@test/render-app-route';
import { setLocale } from '@shared/i18n/i18n';

type MockCapabilities = Parameters<typeof setMockCurrentActorCapabilities>[0];

const makeCapabilities = (
  overrides: Partial<Pick<MockCapabilities, 'permissions' | 'roles' | 'scopeGrants' | 'type'>>,
): MockCapabilities => ({
  id: 'people-readiness-test-user',
  type: overrides.type ?? 'admin',
  context: 'ADMIN',
  isActive: true,
  roles: overrides.roles ?? [],
  permissions: overrides.permissions ?? ['employmentProfile.read'],
  scopeGrants: overrides.scopeGrants ?? {},
  generatedAt: '2026-06-07T00:00:00.000Z',
});

const renderPeopleReadinessRoute = async (
  capabilities = makeCapabilities({}),
  path = '/people-readiness',
  locale: 'en' | 'vi' | 'zh' = 'en',
) => {
  await setLocale(locale);
  setMockCurrentActorCapabilities(capabilities);
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />, { queryClient });
  });
};

const waitForIssuesRequest = async (): Promise<URL> => {
  await waitFor(() => {
    expect(peopleReadinessRequestLog.some((url) => url.includes('/issues'))).toBe(true);
  });
  const raw = peopleReadinessRequestLog.find((url) => url.includes('/issues'));
  if (!raw) {
    throw new Error('People Readiness issues request was not captured');
  }
  return new URL(raw);
};

const lastIssuesRequest = (): URL => {
  const raw = [...peopleReadinessRequestLog].reverse().find((url) => url.includes('/issues'));
  if (!raw) {
    throw new Error('People Readiness issues request was not captured');
  }
  return new URL(raw);
};

describe('People Profile Check dashboard', () => {
  it('strictly parses the Employment Terms category and five issue codes while rejecting unknown codes', () => {
    const codes = [
      'ACTIVE_PROFILE_MISSING_EMPLOYMENT_TERMS',
      'EMPLOYMENT_TERMS_PENDING_APPROVAL',
      'EMPLOYMENT_TERMS_EXPIRED',
      'EMPLOYMENT_TERMS_MISSING_BASE_SALARY',
      'EMPLOYMENT_TERMS_OVERLAP',
    ] as const;
    const items = codes.map((issueCode) => employmentTermsIssue(issueCode));
    const response = {
      data: {
        items,
        nextCursor: null,
        totalCount: items.length,
        generatedAt: Date.parse('2026-06-07T02:00:00.000Z'),
        appliedFilters: { category: 'EMPLOYMENT_TERMS_READY' },
      },
    };

    expect(parsePeopleReadinessIssueListResponse(response).items).toHaveLength(5);
    expect(() =>
      parsePeopleReadinessIssueListResponse({
        ...response,
        data: {
          ...response.data,
          items: [{ ...items[0], issueCode: 'UNKNOWN_EMPLOYMENT_TERMS_CODE' }],
        },
      }),
    ).toThrow();
  });

  it('renders the authorized Admin route through the Admin shell and sidebar', async () => {
    await renderPeopleReadinessRoute();

    expect(await screen.findByTestId('admin-shell-main')).toBeInTheDocument();
    expect(await screen.findByTestId('nav-link-people-readiness')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'People Profile Check' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'People Profile Check' })).toHaveLength(1);
    expect(await screen.findByText('Issue Inbox')).toBeInTheDocument();
    expect(screen.getByText('Read-only.')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-shell')).not.toBeInTheDocument();
  });

  it('uses the Vietnamese People Profile Check naming in the route and sidebar', async () => {
    await renderPeopleReadinessRoute(makeCapabilities({}), '/people-readiness', 'vi');

    expect(
      await screen.findByRole('heading', { name: 'Kiểm tra hồ sơ nhân sự' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Kiểm tra hồ sơ nhân sự' })).toHaveLength(1);
    expect(screen.getByTestId('nav-link-people-readiness')).toHaveTextContent(
      'Kiểm tra hồ sơ nhân sự',
    );
    expect(screen.queryByText('Sẵn sàng nhân sự')).not.toBeInTheDocument();
  });

  it('fails closed for unsupported Manager and Self-Service style actors', async () => {
    await renderPeopleReadinessRoute(
      makeCapabilities({
        roles: ['TEAM_MANAGER'],
        permissions: ['workSchedule.read', 'kpi.read'],
        scopeGrants: {
          workSchedule: ['self', 'team'],
          kpi: ['managedGroup'],
        },
      }),
    );

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-people-readiness')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();

    cleanup();
    await renderPeopleReadinessRoute(
      makeCapabilities({
        roles: ['TALENT_STAFF_SELF'],
        permissions: ['employmentProfile.read', 'workSchedule.read'],
        scopeGrants: {
          workSchedule: ['self'],
          kpi: ['self'],
        },
      }),
    );

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-people-readiness')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-shell')).not.toBeInTheDocument();
  });

  it('consumes summary and issue endpoints with supported params only', async () => {
    await renderPeopleReadinessRoute();

    expect(await screen.findByText('Urgent issues')).toBeInTheDocument();
    const overviewSection = screen.getByRole('heading', { name: 'Overview' }).closest('section');

    if (!overviewSection) {
      throw new Error('People Readiness overview did not render');
    }

    expect(within(overviewSection).getAllByRole('button')).toHaveLength(3);
    expect(
      within(overviewSection).getByRole('button', { name: /Urgent issues/i }),
    ).toBeInTheDocument();
    expect(within(overviewSection).getByRole('button', { name: /Warnings/i })).toBeInTheDocument();
    expect(
      within(overviewSection).getByRole('button', { name: /Information/i }),
    ).toBeInTheDocument();
    expect(within(overviewSection).queryByText('Employment terms')).not.toBeInTheDocument();
    expect(within(overviewSection).queryByText('Account / Self-Service')).not.toBeInTheDocument();
    expect(within(overviewSection).queryByText('Self-Service risks')).not.toBeInTheDocument();
    expect(within(overviewSection).queryByText('Manager readiness risks')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Employment terms' })).toHaveValue(
      'EMPLOYMENT_TERMS_READY',
    );
    expect(screen.getByRole('option', { name: 'Self-Service risks' })).toHaveValue(
      'SELF_SERVICE_READY',
    );
    expect(screen.getByRole('option', { name: 'Manager readiness' })).toHaveValue(
      'MANAGER_ASSIGNMENT_READY',
    );
    expect(await screen.findByText('No Org Person')).toBeInTheDocument();
    expect(screen.getByText('EMPLOYMENT_PROFILE_MISSING_ORG_UNIT')).toBeInTheDocument();
    expect(screen.getAllByText('Open related Admin record')[0]).toHaveAttribute(
      'href',
      '/employment-profiles/ep-no-org',
    );

    const issuesUrl = await waitForIssuesRequest();
    expect(issuesUrl.pathname).toBe('/admin/people-readiness/issues');
    expect(Array.from(issuesUrl.searchParams.keys()).sort()).toEqual(['limit']);
    expect(issuesUrl.searchParams.get('limit')).toBe('10');
  });

  it('emits exact supported filters and keeps cursor pagination opaque', async () => {
    await renderPeopleReadinessRoute();
    await screen.findByText('No Org Person');

    await userEvent.selectOptions(
      screen.getByLabelText('Affected flow'),
      'MANAGER_ASSIGNMENT_READY',
    );
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'BLOCKER');
    await userEvent.selectOptions(
      screen.getByLabelText('Primary entity'),
      'ORG_UNIT_MANAGER_ASSIGNMENT',
    );
    await userEvent.selectOptions(
      screen.getByLabelText('Issue type'),
      'ORGUNIT_MANAGER_ASSIGNMENT_MANAGER_NOT_LOGIN_READY',
    );
    await userEvent.selectOptions(screen.getByLabelText('Rows'), '25');

    await waitFor(() => {
      const params = lastIssuesRequest().searchParams;
      expect(params.get('category')).toBe('MANAGER_ASSIGNMENT_READY');
      expect(params.get('severity')).toBe('BLOCKER');
      expect(params.get('entityType')).toBe('ORG_UNIT_MANAGER_ASSIGNMENT');
      expect(params.get('issueCode')).toBe('ORGUNIT_MANAGER_ASSIGNMENT_MANAGER_NOT_LOGIN_READY');
      expect(params.get('limit')).toBe('25');
    });

    expect(Array.from(lastIssuesRequest().searchParams.keys()).sort()).toEqual([
      'category',
      'entityType',
      'issueCode',
      'limit',
      'severity',
    ]);

    await userEvent.selectOptions(screen.getByLabelText('Affected flow'), '');
    await userEvent.selectOptions(screen.getByLabelText('Severity'), '');
    await userEvent.selectOptions(screen.getByLabelText('Primary entity'), '');
    await userEvent.selectOptions(screen.getByLabelText('Issue type'), '');
    await userEvent.selectOptions(screen.getByLabelText('Rows'), '2');

    await waitFor(() => {
      expect(lastIssuesRequest().searchParams.get('limit')).toBe('2');
      expect(lastIssuesRequest().searchParams.has('category')).toBe(false);
    });

    const nextButton = screen.getByRole('button', { name: i18n.t('common:actions.next') });
    expect(nextButton).toBeEnabled();
    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(lastIssuesRequest().searchParams.get('cursor')).toBe('opaque-cursor-2');
    });
    expect(lastIssuesRequest().searchParams.has('search')).toBe(false);
    expect(lastIssuesRequest().searchParams.has('sortBy')).toBe(false);
    expect(lastIssuesRequest().searchParams.has('bulk')).toBe(false);

    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'WARNING');
    await waitFor(() => {
      const params = lastIssuesRequest().searchParams;
      expect(params.get('severity')).toBe('WARNING');
      expect(params.has('cursor')).toBe(false);
    });
  });

  it('uses overview cards as backend-supported quick filters and keeps dropdowns in sync', async () => {
    await renderPeopleReadinessRoute();
    await screen.findByText('No Org Person');

    await userEvent.click(screen.getByRole('button', { name: /Urgent issues/i }));
    await waitFor(() => {
      expect(lastIssuesRequest().searchParams.get('severity')).toBe('BLOCKER');
    });
    expect(screen.getByRole('button', { name: /Urgent issues/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('Severity')).toHaveValue('BLOCKER');

    await userEvent.click(screen.getByRole('button', { name: /Urgent issues/i }));
    await waitFor(() => {
      expect(lastIssuesRequest().searchParams.has('severity')).toBe(false);
    });
    expect(screen.getByRole('button', { name: /Urgent issues/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByLabelText('Severity')).toHaveValue('');

    const warningCard = screen.getByRole('button', { name: /Warnings/i });
    await userEvent.click(warningCard);
    await waitFor(() => {
      expect(lastIssuesRequest().searchParams.get('severity')).toBe('WARNING');
    });
    expect(screen.getByRole('button', { name: /Warnings/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('Severity')).toHaveValue('WARNING');

    await userEvent.click(screen.getByRole('button', { name: /Information/i }));
    await waitFor(() => {
      expect(lastIssuesRequest().searchParams.get('severity')).toBe('INFO');
    });
    expect(screen.getByRole('button', { name: /Warnings/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /Information/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('Severity')).toHaveValue('INFO');

    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'BLOCKER');
    await waitFor(() => {
      expect(lastIssuesRequest().searchParams.get('severity')).toBe('BLOCKER');
    });
    expect(screen.getByRole('button', { name: /Urgent issues/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Information/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(lastIssuesRequest().searchParams.has('category')).toBe(false);
    expect(screen.queryByRole('button', { name: /Employment terms/i })).not.toBeInTheDocument();
  });

  it('renders empty and backend forbidden states cleanly', async () => {
    setPeopleReadinessIssues([]);
    await renderPeopleReadinessRoute();

    expect(await screen.findByText('No issues in this filter')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No backend readiness issues match the current filter. This is not a production or runtime readiness claim.',
      ),
    ).toBeInTheDocument();

    cleanup();
    server.use(
      http.get('*/admin/people-readiness/summary', () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Denied' } }, { status: 403 }),
      ),
    );
    await renderPeopleReadinessRoute();

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
  });

  it('does not display backend metadata or offer repair mutations', async () => {
    let mutationCount = 0;
    setPeopleReadinessIssues([
      {
        ...employmentTermsIssue('EMPLOYMENT_TERMS_EXPIRED'),
        metadata: {
          internalDiagnostic: 'classification-only',
        },
      },
    ]);
    server.use(
      http.post('*/admin/people-readiness/:action', () => {
        mutationCount += 1;
        return HttpResponse.json({ message: 'unexpected' }, { status: 500 });
      }),
    );

    await renderPeopleReadinessRoute();
    await screen.findByText('Employment Terms Person');

    expect(screen.queryByText('classification-only')).not.toBeInTheDocument();
    expect(screen.queryByText('internalDiagnostic')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fix all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /repair/i })).not.toBeInTheDocument();
    expect(mutationCount).toBe(0);
  });

  it('renders localized HRET copy and filters without displaying backend summary or metadata', async () => {
    const issue = {
      ...employmentTermsIssue('EMPLOYMENT_TERMS_MISSING_BASE_SALARY'),
      metadata: {
        internalDiagnostic: 'classification-only',
      },
    };
    setPeopleReadinessIssues([issue]);
    await renderPeopleReadinessRoute();

    expect(
      await screen.findByRole('heading', { name: 'Base salary data is missing' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Current candidate terms do not contain valid base salary data.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Employment terms' })).toHaveValue(
      'EMPLOYMENT_TERMS_READY',
    );
    expect(screen.getByRole('option', { name: 'Employment Terms overlap' })).toHaveValue(
      'EMPLOYMENT_TERMS_OVERLAP',
    );
    expect(screen.queryByText('Backend summary is not user-facing.')).not.toBeInTheDocument();
    expect(screen.queryByText('classification-only')).not.toBeInTheDocument();
    expect(screen.queryByText('internalDiagnostic')).not.toBeInTheDocument();
  });

  it('renders issue cards with distinct severity/category badges and secondary technical code', async () => {
    setPeopleReadinessIssues([
      {
        ...employmentTermsIssue('EMPLOYMENT_TERMS_MISSING_BASE_SALARY'),
        metadata: {
          allowanceAmount: 16000000,
          currency: 'VND',
          sourceNote: 'Approved salary source note',
          rawEmploymentTermsId: 'hret-raw-secret-1',
        },
      },
    ]);
    await renderPeopleReadinessRoute();

    const heading = await screen.findByRole('heading', { name: 'Base salary data is missing' });
    const article = heading.closest('article');

    if (!article) {
      throw new Error('Issue row did not render as an article');
    }

    const affectedProfile = within(article).getByTestId('people-readiness-affected-profile');
    expect(affectedProfile).toHaveAttribute('data-layout', 'compact-header');
    expect(affectedProfile.querySelector('.rounded.border')).toBeNull();
    expect(within(affectedProfile).getByText('Affected profile')).toBeInTheDocument();
    expect(within(article).getByText('Employment Terms Person')).toBeInTheDocument();
    expect(within(article).getByText('EP-HRET')).toBeInTheDocument();
    expect(within(article).getByText('Active')).toBeInTheDocument();
    expect(within(article).getByText('Issue')).toBeInTheDocument();
    expect(within(article).getByText('Description')).toBeInTheDocument();
    expect(
      within(article).getByText('Current candidate terms do not contain valid base salary data.'),
    ).toBeInTheDocument();
    expect(within(article).getByText('Severity')).toBeInTheDocument();
    expect(within(article).getAllByText('Needs urgent handling')).toHaveLength(1);
    expect(within(article).getByText('Issue category')).toBeInTheDocument();
    expect(within(article).getByText('Employment terms')).toBeInTheDocument();
    expect(
      within(article).getByRole('link', { name: 'Open employment terms / pay conditions' }),
    ).toHaveAttribute('href', '/employment-profiles/ep-hret#employment-terms');
    expect(within(article).getByText('Diagnostic code')).toBeInTheDocument();
    expect(within(article).getByText('EMPLOYMENT_TERMS_MISSING_BASE_SALARY')).toBeInTheDocument();
    expect(within(article).queryByText(/allowance amount/i)).not.toBeInTheDocument();
    expect(within(article).queryByText(/VND/)).not.toBeInTheDocument();
    expect(within(article).queryByText('Approved salary source note')).not.toBeInTheDocument();
    expect(within(article).queryByText('hret-raw-secret-1')).not.toBeInTheDocument();
  });

  it('renders localized titles and descriptions for all five HRET issue codes', async () => {
    const codes = [
      'ACTIVE_PROFILE_MISSING_EMPLOYMENT_TERMS',
      'EMPLOYMENT_TERMS_PENDING_APPROVAL',
      'EMPLOYMENT_TERMS_EXPIRED',
      'EMPLOYMENT_TERMS_MISSING_BASE_SALARY',
      'EMPLOYMENT_TERMS_OVERLAP',
    ] as const;
    setPeopleReadinessIssues(codes.map((code, index) => employmentTermsIssue(code, `ep-${index}`)));
    await renderPeopleReadinessRoute();

    for (const code of codes) {
      expect(
        await screen.findByRole('heading', {
          name: i18n.t(`people-readiness:issueTitles.${code}`),
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(i18n.t(`people-readiness:issueDescriptions.${code}`)),
      ).toBeInTheDocument();
    }

    cleanup();
    await setLocale('vi');
    expect(i18n.t('people-readiness:issueTitles.ACTIVE_PROFILE_MISSING_EMPLOYMENT_TERMS')).toBe(
      'Thiếu điều khoản lương',
    );
    await setLocale('zh');
    expect(i18n.t('people-readiness:issueTitles.EMPLOYMENT_TERMS_OVERLAP')).toBe(
      '雇佣条款有效期重叠',
    );
  });

  it('navigates HRET repair targets to the section and preserves no-access no-fetch behavior', async () => {
    setPeopleReadinessIssues([
      employmentTermsIssue('ACTIVE_PROFILE_MISSING_EMPLOYMENT_TERMS', 'ep-001'),
    ]);
    let employmentTermsFetchCount = 0;
    let contractRegistryRequestCount = 0;
    server.use(
      http.get('*/admin/employment-profiles/:employmentProfileId/employment-terms', () => {
        employmentTermsFetchCount += 1;
        return HttpResponse.json({ data: [] });
      }),
      http.all('*/admin/contract-records*', () => {
        contractRegistryRequestCount += 1;
        return HttpResponse.json({ data: { items: [] } });
      }),
    );
    await renderPeopleReadinessRoute(makeCapabilities({ permissions: ['employmentProfile.read'] }));

    const link = await screen.findByRole('link', {
      name: 'Open employment terms / pay conditions',
    });
    expect(link).toHaveAttribute('href', '/employment-profiles/ep-001#employment-terms');
    await userEvent.click(link);

    const heading = await screen.findByRole('heading', { name: /Employment Terms/i });
    expect(heading.closest('section')).toHaveAttribute('id', 'employment-terms');
    expect(
      screen.getByText(i18n.t('employment-profile:employmentTerms.accessRequired')),
    ).toBeInTheDocument();
    expect(employmentTermsFetchCount).toBe(0);
    expect(contractRegistryRequestCount).toBe(0);
  });

  it('renders non-actionable repair hints when no safe detail route exists', async () => {
    const unsafeIssue: PeopleReadinessIssue = {
      id: 'ORGUNIT_MANAGER_ASSIGNMENT_MANAGER_NOT_PROFILE_READY:ORG_UNIT_MANAGER_ASSIGNMENT:bad',
      issueCode: 'ORGUNIT_MANAGER_ASSIGNMENT_MANAGER_NOT_PROFILE_READY',
      category: 'MANAGER_ASSIGNMENT_READY',
      severity: 'BLOCKER',
      primaryEntityType: 'ORG_UNIT_MANAGER_ASSIGNMENT',
      primaryEntity: {
        entityType: 'ORG_UNIT_MANAGER_ASSIGNMENT',
        id: 'bad',
        displayName: 'UNIT_MANAGER assignment',
        status: 'ACTIVE',
      },
      relatedEntities: [],
      summary: 'Manager assignment manager is not profile-ready.',
      repairTarget: {
        targetType: 'ORG_UNIT_MANAGER_ASSIGNMENT',
        targetId: 'bad',
        suggestedSurface: 'ADMIN_PEOPLE_READINESS',
        suggestedAction: 'Review manager assignment',
      },
      generatedAt: Date.parse('2026-06-07T02:00:00.000Z'),
      isBlockingForNewOperations: true,
    };
    setPeopleReadinessIssues([unsafeIssue]);

    await renderPeopleReadinessRoute();
    const row = await screen.findByRole('heading', {
      name: 'OrgUnit manager profile is not ready',
    });
    const article = row.closest('article');

    if (!article) {
      throw new Error('Issue row did not render as an article');
    }

    expect(within(article).getByText(/No safe detail route is available/)).toBeInTheDocument();
    expect(within(article).queryByRole('link', { name: 'Open related Admin record' })).toBeNull();
  });

  it('places People Profile Check under People & Organization and not Operations', async () => {
    await renderPeopleReadinessRoute(
      makeCapabilities({
        permissions: [
          'employmentProfile.read',
          'orgUnit.read',
          'workSchedule.read',
          'eventAssignment.read',
        ],
        scopeGrants: {
          workSchedule: ['global'],
          eventAssignment: ['global'],
        },
      }),
    );

    const peopleLink = await screen.findByTestId('nav-link-people-readiness');
    const peopleSection = peopleLink.closest('section');

    if (!peopleSection) {
      throw new Error('People Profile Check nav link did not render inside a section');
    }

    expect(within(peopleSection).getByText('People & Organization')).toBeInTheDocument();
    expect(within(peopleSection).getByText('Org Units')).toBeInTheDocument();
    expect(within(peopleSection).getByText('Employment Profiles')).toBeInTheDocument();

    const operationsHeader = screen.getByText('Operations');
    const operationsSection = operationsHeader.closest('section');

    if (!operationsSection) {
      throw new Error('Operations nav section did not render');
    }

    expect(within(operationsSection).queryByTestId('nav-link-people-readiness')).toBeNull();
    expect(within(operationsSection).queryByText('Employment Terms')).not.toBeInTheDocument();
  });
});

const employmentTermsIssue = (
  issueCode:
    | 'ACTIVE_PROFILE_MISSING_EMPLOYMENT_TERMS'
    | 'EMPLOYMENT_TERMS_PENDING_APPROVAL'
    | 'EMPLOYMENT_TERMS_EXPIRED'
    | 'EMPLOYMENT_TERMS_MISSING_BASE_SALARY'
    | 'EMPLOYMENT_TERMS_OVERLAP',
  employmentProfileId = 'ep-hret',
): PeopleReadinessIssue => ({
  id: `${issueCode}:EMPLOYMENT_PROFILE:${employmentProfileId}`,
  issueCode,
  category: 'EMPLOYMENT_TERMS_READY',
  severity: issueCode === 'EMPLOYMENT_TERMS_PENDING_APPROVAL' ? 'WARNING' : 'BLOCKER',
  primaryEntityType: 'EMPLOYMENT_PROFILE',
  primaryEntity: {
    entityType: 'EMPLOYMENT_PROFILE',
    id: employmentProfileId,
    displayName: 'Employment Terms Person',
    code: 'EP-HRET',
    lifecycleStatus: 'ACTIVE',
    adminRepairTarget: `/employment-profiles/${employmentProfileId}`,
  },
  relatedEntities: [],
  summary: 'Backend summary is not user-facing.',
  repairTarget: {
    targetType: 'EMPLOYMENT_PROFILE',
    targetId: employmentProfileId,
    suggestedSurface: `/employment-profiles/${employmentProfileId}#employment-terms`,
    suggestedAction: 'Review Employment Terms',
  },
  generatedAt: Date.parse('2026-06-07T02:00:00.000Z'),
  isBlockingForNewOperations: issueCode !== 'EMPLOYMENT_TERMS_PENDING_APPROVAL',
});
