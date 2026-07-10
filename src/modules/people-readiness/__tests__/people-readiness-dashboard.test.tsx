import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import {
  PEOPLE_READINESS_CATEGORIES,
  PEOPLE_READINESS_ENTITY_TYPES,
  PEOPLE_READINESS_ISSUE_CODES,
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
  overrides: Partial<
    Pick<
      MockCapabilities,
      'permissions' | 'roles' | 'scopeGrants' | 'type' | 'accountContexts' | 'workspaceAvailability'
    >
  >,
): MockCapabilities => ({
  id: 'people-readiness-test-user',
  type: overrides.type ?? 'admin',
  context: 'ADMIN',
  isActive: true,
  roles: overrides.roles ?? [],
  permissions: overrides.permissions ?? ['employmentProfile.read'],
  scopeGrants: overrides.scopeGrants ?? {},
  accountContexts: overrides.accountContexts ?? ['ADMIN_CONSOLE'],
  workspaceAvailability: overrides.workspaceAvailability,
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
  it('strictly parses the complete backend enum contract and rejects unknown codes', () => {
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
    for (const category of PEOPLE_READINESS_CATEGORIES) {
      expect(() =>
        parsePeopleReadinessIssueListResponse({
          ...response,
          data: { ...response.data, items: [{ ...items[0], category }] },
        }),
      ).not.toThrow();
    }
    for (const entityType of PEOPLE_READINESS_ENTITY_TYPES) {
      expect(() =>
        parsePeopleReadinessIssueListResponse({
          ...response,
          data: {
            ...response.data,
            items: [
              {
                ...items[0],
                primaryEntityType: entityType,
                primaryEntity: { ...items[0].primaryEntity, entityType },
                repairTarget: { ...items[0].repairTarget, targetType: entityType },
              },
            ],
          },
        }),
      ).not.toThrow();
    }
    for (const issueCode of PEOPLE_READINESS_ISSUE_CODES) {
      expect(() =>
        parsePeopleReadinessIssueListResponse({
          ...response,
          data: { ...response.data, items: [{ ...items[0], issueCode }] },
        }),
      ).not.toThrow();
    }
    expect(
      parsePeopleReadinessIssueListResponse({
        ...response,
        data: {
          ...response.data,
          nextCursor: 'MjA',
          items: [
            {
              ...items[0],
              issueCode: 'TALENTGROUP_RESPONSIBILITY_MANAGER_NOT_LOGIN_READY',
              category: 'RESPONSIBILITY_READY',
              primaryEntityType: 'TALENT_GROUP_RESPONSIBILITY',
              primaryEntity: {
                ...items[0].primaryEntity,
                entityType: 'TALENT_GROUP_RESPONSIBILITY',
              },
              repairTarget: {
                ...items[0].repairTarget,
                targetType: 'TALENT_GROUP_RESPONSIBILITY',
              },
            },
          ],
        },
      }).nextCursor,
    ).toBe('MjA');
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

  it('provides localized responsibility labels without raw-code fallback', async () => {
    const expected = {
      en: {
        category: 'Responsibility readiness',
        entity: 'OrgUnit responsibility',
        issue: 'OrgUnit responsibility holder profile is not ready',
      },
      vi: {
        category: 'Sẵn sàng trách nhiệm',
        entity: 'Trách nhiệm đơn vị tổ chức',
        issue: 'Người phụ trách đơn vị chưa sẵn sàng hồ sơ',
      },
      zh: {
        category: '职责就绪',
        entity: '组织单元职责',
        issue: 'OrgUnit 负责人档案未就绪',
      },
    } as const;

    for (const [locale, labels] of Object.entries(expected) as Array<
      [keyof typeof expected, (typeof expected)[keyof typeof expected]]
    >) {
      await setLocale(locale);
      expect(i18n.t('people-readiness:categories.RESPONSIBILITY_READY')).toBe(labels.category);
      expect(i18n.t('people-readiness:entities.ORG_UNIT_RESPONSIBILITY')).toBe(labels.entity);
      expect(
        i18n.t('people-readiness:issueTitles.ORGUNIT_RESPONSIBILITY_MANAGER_NOT_PROFILE_READY'),
      ).toBe(labels.issue);
      expect(
        i18n.t('people-readiness:issueTitles.TALENTGROUP_RESPONSIBILITY_MANAGER_NOT_LOGIN_READY'),
      ).not.toBe('TALENTGROUP_RESPONSIBILITY_MANAGER_NOT_LOGIN_READY');
    }
    await setLocale('en');
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
        accountContexts: ['MANAGER_CONSOLE'],
      }),
    );

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-people-readiness')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
    expect(peopleReadinessRequestLog).toHaveLength(0);

    cleanup();
    await renderPeopleReadinessRoute(
      makeCapabilities({
        roles: ['TALENT_STAFF_SELF'],
        permissions: ['employmentProfile.read', 'workSchedule.read'],
        scopeGrants: {
          workSchedule: ['self'],
          kpi: ['self'],
        },
        accountContexts: ['STAFF_CONSOLE'],
      }),
    );

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-people-readiness')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-shell')).not.toBeInTheDocument();
    expect(peopleReadinessRequestLog).toHaveLength(0);
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
    expect(screen.getByRole('option', { name: 'Responsibility readiness' })).toHaveValue(
      'RESPONSIBILITY_READY',
    );
    expect(await screen.findByText('No Org Person')).toBeInTheDocument();
    expect(screen.getAllByText('Technical details').length).toBeGreaterThan(0);
    const firstTechnicalCode = document.querySelector('details pre');
    expect(firstTechnicalCode).toHaveTextContent('EMPLOYMENT_PROFILE_MISSING_ORG_UNIT');
    expect(firstTechnicalCode).not.toBeVisible();
    expect(screen.getAllByText('Open related Admin record')[0]).toHaveAttribute(
      'href',
      '/employment-profiles/ep-no-org',
    );

    const issuesUrl = await waitForIssuesRequest();
    expect(issuesUrl.pathname).toBe('/admin/people-readiness/issues');
    expect(Array.from(issuesUrl.searchParams.keys()).sort()).toEqual(['limit']);
    expect(issuesUrl.searchParams.get('limit')).toBe('10');
  });

  it('emits exact supported filters, resets them, and keeps cursor pagination opaque', async () => {
    await renderPeopleReadinessRoute();
    await screen.findByText('No Org Person');

    await userEvent.selectOptions(
      screen.getByLabelText('Affected flow'),
      'RESPONSIBILITY_READY',
    );
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'BLOCKER');
    await userEvent.selectOptions(
      screen.getByLabelText('Primary entity'),
      'ORG_UNIT_RESPONSIBILITY',
    );
    await userEvent.selectOptions(
      screen.getByLabelText('Issue type'),
      'ORGUNIT_RESPONSIBILITY_MANAGER_NOT_LOGIN_READY',
    );
    await userEvent.selectOptions(screen.getByLabelText('Rows'), '25');

    await waitFor(() => {
      const params = lastIssuesRequest().searchParams;
      expect(params.get('category')).toBe('RESPONSIBILITY_READY');
      expect(params.get('severity')).toBe('BLOCKER');
      expect(params.get('entityType')).toBe('ORG_UNIT_RESPONSIBILITY');
      expect(params.get('issueCode')).toBe('ORGUNIT_RESPONSIBILITY_MANAGER_NOT_LOGIN_READY');
      expect(params.get('limit')).toBe('25');
    });

    expect(Array.from(lastIssuesRequest().searchParams.keys()).sort()).toEqual([
      'category',
      'entityType',
      'issueCode',
      'limit',
      'severity',
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() => {
      const params = lastIssuesRequest().searchParams;
      expect(Array.from(params.keys()).sort()).toEqual(['limit']);
      expect(params.get('limit')).toBe('10');
    });

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
  }, 10_000);

  it('enables Clear all for cursor-only history and resets both cursor and filters without mutation', async () => {
    const requests: URL[] = [];
    let mutationCount = 0;
    server.use(
      http.get('*/admin/people-readiness/issues', ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        const cursor = url.searchParams.get('cursor');
        return HttpResponse.json({
          data: {
            items: [employmentTermsIssue('ACTIVE_PROFILE_MISSING_EMPLOYMENT_TERMS')],
            nextCursor: cursor ? null : 'opaque-next-cursor',
            totalCount: 2,
            generatedAt: Date.parse('2026-06-07T02:00:00.000Z'),
            appliedFilters: url.searchParams.get('severity')
              ? { severity: url.searchParams.get('severity') }
              : {},
          },
        });
      }),
      http.post('*/admin/people-readiness/*', () => {
        mutationCount += 1;
        return HttpResponse.json({ message: 'unexpected' }, { status: 500 });
      }),
    );

    await renderPeopleReadinessRoute();
    await screen.findByText('Employment Terms Person');

    expect(screen.getByRole('button', { name: 'Clear all' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: i18n.t('common:actions.next') }));
    await waitFor(() => {
      expect(requests.at(-1)?.searchParams.get('cursor')).toBe('opaque-next-cursor');
    });
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() => {
      const request = requests.at(-1);
      expect(request?.searchParams.get('cursor')).toBeNull();
      expect(request?.searchParams.get('severity')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'BLOCKER');
    await userEvent.click(screen.getByRole('button', { name: i18n.t('common:actions.next') }));
    await waitFor(() => {
      const request = requests.at(-1);
      expect(request?.searchParams.get('cursor')).toBe('opaque-next-cursor');
      expect(request?.searchParams.get('severity')).toBe('BLOCKER');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() => {
      const request = requests.at(-1);
      expect(request?.searchParams.get('cursor')).toBeNull();
      expect(request?.searchParams.get('severity')).toBeNull();
      expect(request?.searchParams.get('limit')).toBe('10');
    });
    expect(screen.getByLabelText('Severity')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeDisabled();
    expect(mutationCount).toBe(0);
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
    const user = userEvent.setup();
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
    expect(within(article).getByText('Technical details')).toBeInTheDocument();
    const technicalDetails = article.querySelector('details');
    const technicalCode = technicalDetails?.querySelector('pre');
    expect(technicalDetails).not.toHaveAttribute('open');
    expect(technicalCode).toHaveTextContent('EMPLOYMENT_TERMS_MISSING_BASE_SALARY');
    expect(technicalCode).not.toBeVisible();
    await user.click(within(article).getByText('Technical details'));
    expect(technicalCode).toBeVisible();
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
      'Thiếu điều khoản làm việc / lương',
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

    expect(await screen.findByRole('heading', { name: 'Employment Profiles' })).toBeInTheDocument();
    expect(employmentTermsFetchCount).toBe(0);
    expect(contractRegistryRequestCount).toBe(0);
  });

  it('renders non-actionable repair hints when no safe detail route exists', async () => {
    const unsafeIssue: PeopleReadinessIssue = {
      id: 'ORGUNIT_RESPONSIBILITY_MANAGER_NOT_PROFILE_READY:ORG_UNIT_RESPONSIBILITY:bad',
      issueCode: 'ORGUNIT_RESPONSIBILITY_MANAGER_NOT_PROFILE_READY',
      category: 'RESPONSIBILITY_READY',
      severity: 'BLOCKER',
      primaryEntityType: 'ORG_UNIT_RESPONSIBILITY',
      primaryEntity: {
        entityType: 'ORG_UNIT_RESPONSIBILITY',
        id: 'bad',
        displayName: 'UNIT_MANAGER assignment',
        status: 'ACTIVE',
      },
      relatedEntities: [],
      summary: 'Manager assignment manager is not profile-ready.',
      repairTarget: {
        targetType: 'ORG_UNIT_RESPONSIBILITY',
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
      name: 'OrgUnit responsibility holder profile is not ready',
    });
    const article = row.closest('article');

    if (!article) {
      throw new Error('Issue row did not render as an article');
    }

    expect(within(article).getByText('Responsibility readiness')).toBeInTheDocument();
    expect(within(article).getByText('OrgUnit responsibility')).toBeInTheDocument();
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

    const workResourcesHeader = screen.getByText('Work Schedule & Resources');
    const workResourcesSection = workResourcesHeader.closest('section');

    if (!workResourcesSection) {
      throw new Error('Work Schedule & Resources nav section did not render');
    }

    expect(within(workResourcesSection).queryByTestId('nav-link-people-readiness')).toBeNull();
    expect(within(workResourcesSection).queryByText('Employment Terms')).not.toBeInTheDocument();
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
