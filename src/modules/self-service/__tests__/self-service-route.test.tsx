import i18n from 'i18next';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { appRoutes } from '@app/router/router';
import { useShellStore } from '@app/store/shell-store';
import { parseSelfServiceKpiResponseForTest } from '@modules/self-service/api/self-service.api';
import { setLocale } from '@shared/i18n/i18n';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import {
  resetSelfServiceMockData,
  setMockSelfServiceEvents,
  setMockSelfServiceCurrentPerson,
  setMockSelfServiceCurrentPersonNotLinked,
  setMockSelfServiceKpi,
  setMockSelfServiceProfileNotOperational,
  setMockSelfServiceTalentGroups,
  setMockSelfServiceWorkShifts,
} from '@test/msw/self-service-handlers';
import { server } from '@test/msw/server';
import { renderAppWithProviders } from '@test/render-app-route';

const mockAuthAdapter = vi.hoisted(() => ({
  initialize: vi.fn(async () => ({
    isAuthenticated: true,
    session: {
      userName: 'Mina Staff',
      capabilityHints: [],
      expiresAt: Date.UTC(2026, 4, 26, 12, 0),
    },
  })),
  getAccessToken: vi.fn(async () => 'mock-access-token'),
  loginRedirect: vi.fn(async () => undefined),
  logoutRedirect: vi.fn(async () => undefined),
  handleCallback: vi.fn(async () => null),
}));

vi.mock('@shared/auth/auth-adapter', () => ({
  createAuthAdapter: () => mockAuthAdapter,
  isAuthConfigurationError: () => false,
}));

type MockCapabilities = Parameters<typeof setMockCurrentActorCapabilities>[0];

const staffCapabilities = (): MockCapabilities => ({
  id: 'user-staff',
  type: 'staff',
  context: 'ADMIN',
  isActive: true,
  roles: ['TALENT_STAFF_SELF'],
  permissions: [
    'workSchedule.read',
    'event.read',
    'talentKpi.read',
    'kpi.readProgress',
    'employmentProfile.read',
    'talent.read',
  ],
  scopeGrants: {
    workSchedule: ['self'],
    kpi: ['self'],
  },
  accountContexts: ['STAFF_CONSOLE'],
  generatedAt: '2026-05-24T00:00:00.000Z',
});

const renderRoute = async (path: string, setup?: () => void): Promise<void> => {
  cleanup();
  await setLocale('en');
  useShellStore.getState().setLocale('en');
  resetSelfServiceMockData();
  setMockCurrentActorCapabilities(staffCapabilities());
  mockAuthAdapter.logoutRedirect.mockClear();
  setup?.();

  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />);
  });
};

const switchSelfServiceModule = async (
  moduleId: 'overview' | 'profile' | 'work' | 'kpi' | 'talentGroups' | 'account',
): Promise<void> => {
  const user = userEvent.setup();
  await user.click(await screen.findByTestId(`self-service-nav-${moduleId}`));
};

const makeSelfServiceKpiItem = (
  overrides: Partial<{
    kpiPlanId: string;
    planCode: string;
    title: string;
    periodMonth: string;
    periodStartAt: number;
    periodEndAt: number;
    officialStatus: 'OFFICIAL_PUBLISHED' | 'OFFICIAL_FINALIZED';
    isCurrentPeriod: boolean;
    isPreviousPeriod: boolean;
    lastUpdatedAt: number;
    metrics: Array<{
      metricCode:
        | 'REVENUE_VND'
        | 'CONTENT_OUTPUT_COUNT'
        | 'LIVE_HOURS'
        | 'EVENT_COMPLETION_COUNT'
        | 'ONBOARDED_TALENT_COUNT'
        | 'TIKTOK_DIAMOND';
      unit: 'VND' | 'COUNT' | 'HOUR';
      targetValue: number;
      actualValue: number;
      progressPercent: number | null;
    }>;
    actualEntryStatusSummary: {
      expectedEntryCount: number;
      enteredEntryCount: number;
      enteredZeroCount: number;
      pendingEntryCount: number;
      overdueEntryCount: number;
      excusedEntryCount: number;
      notRequiredEntryCount: number;
      notDueEntryCount: number;
    };
  }> = {},
) => ({
  kpiPlanId: overrides.kpiPlanId ?? 'kpi-plan-current',
  planCode: overrides.planCode ?? 'KPI-SELF-202606',
  title: overrides.title ?? 'June operations KPI',
  periodMonth: overrides.periodMonth ?? '2026-06',
  periodStartAt: overrides.periodStartAt ?? Date.UTC(2026, 5, 1, -7, 0),
  periodEndAt: overrides.periodEndAt ?? Date.UTC(2026, 6, 1, -7, 0) - 1,
  officialStatus: overrides.officialStatus ?? 'OFFICIAL_PUBLISHED',
  isCurrentPeriod: overrides.isCurrentPeriod ?? true,
  isPreviousPeriod: overrides.isPreviousPeriod ?? false,
  isReadOnly: true as const,
  lastUpdatedAt: overrides.lastUpdatedAt ?? Date.UTC(2026, 5, 10, 4, 0),
  metrics: overrides.metrics ?? [
    {
      metricCode: 'REVENUE_VND' as const,
      unit: 'VND' as const,
      targetValue: 10000000,
      actualValue: 4500000,
      progressPercent: 45,
    },
  ],
  actualEntryStatusSummary: overrides.actualEntryStatusSummary ?? {
    expectedEntryCount: 62,
    enteredEntryCount: 12,
    enteredZeroCount: 1,
    pendingEntryCount: 4,
    overdueEntryCount: 2,
    excusedEntryCount: 1,
    notRequiredEntryCount: 1,
    notDueEntryCount: 42,
  },
});

describe('/self-service route', () => {
  it('routes staff actors from root landing into the self-service shell', async () => {
    await renderRoute('/');

    expect(await screen.findByTestId('self-service-shell')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Personal data' })).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-navigation')).not.toBeInTheDocument();
  });

  it('fails closed from root landing when workspace availability is denied', async () => {
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Permission denied' } },
          { status: 403 },
        ),
      ),
    );

    await renderRoute('/');

    expect(await screen.findByText('Chưa có chức năng được phân quyền')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/workspace|console|account context/i);
    expect(screen.queryByTestId('self-service-shell')).not.toBeInTheDocument();
  });

  it('renders staff shell with Overview as the default active panel outside the admin sidebar', async () => {
    await renderRoute('/self-service');

    expect(await screen.findByTestId('self-service-shell')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Personal data' })).toBeInTheDocument();
    expect(await screen.findByTestId('self-service-overview')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect((await screen.findAllByText('Mina Staff')).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('Employment profile · EP-SELF-001')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My KPI' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-account-card')).not.toBeInTheDocument();
    expect(screen.queryByText('mina.staff@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('Creator Mina')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-employment-profiles')).not.toBeInTheDocument();
  });

  it('localizes Asia/Saigon in the Vietnamese Overview before switching panels', async () => {
    await renderRoute('/self-service');

    await act(async () => {
      await setLocale('vi');
    });

    const overview = await screen.findByTestId('self-service-overview');
    expect(within(overview).getByText(/Giờ Việt Nam/)).toBeInTheDocument();
    expect(overview.textContent ?? '').not.toContain('Asia/Saigon');
  });

  it('localizes Asia/Ho_Chi_Minh in the Vietnamese Overview before switching panels', async () => {
    await renderRoute('/self-service', () =>
      setMockSelfServiceCurrentPerson({
        employmentProfileId: 'ep-timezone-alias',
        employeeCode: 'EP-TIMEZONE-ALIAS',
        displayName: 'Timezone Alias Staff',
        employmentStatus: 'ACTIVE',
        accountEmail: 'timezone.alias@example.test',
        accountStatus: 'ACTIVE',
        accountLinkStatus: 'LINKED',
        locale: 'vi',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    );

    await act(async () => {
      await setLocale('vi');
    });

    const overview = await screen.findByTestId('self-service-overview');
    expect(within(overview).getByText(/Giờ Việt Nam/)).toBeInTheDocument();
    expect(overview.textContent ?? '').not.toContain('Asia/Ho_Chi_Minh');
  });

  it('uses neutral copy for an unexpected stored timezone in the Vietnamese Overview', async () => {
    await renderRoute('/self-service', () =>
      setMockSelfServiceCurrentPerson({
        employmentProfileId: 'ep-timezone-unexpected',
        employeeCode: 'EP-TIMEZONE-UNEXPECTED',
        displayName: 'Unexpected Timezone Staff',
        employmentStatus: 'ACTIVE',
        accountEmail: 'unexpected.timezone@example.test',
        accountStatus: 'ACTIVE',
        accountLinkStatus: 'LINKED',
        locale: 'vi',
        timezone: 'Pacific/Chatham',
      }),
    );

    await act(async () => {
      await setLocale('vi');
    });

    const overview = await screen.findByTestId('self-service-overview');
    expect(within(overview).getByText(/Múi giờ đã thiết lập/)).toBeInTheDocument();
    expect(overview.textContent ?? '').not.toContain('Pacific/Chatham');
  });

  it('uses button module switching instead of anchor-scroll navigation and updates active state', async () => {
    await renderRoute('/self-service');

    const user = userEvent.setup();
    const overviewTab = await screen.findByTestId('self-service-nav-overview');
    const profileTab = await screen.findByTestId('self-service-nav-profile');

    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(profileTab).toHaveAttribute('aria-selected', 'false');
    expect(profileTab.tagName).toBe('BUTTON');
    expect(profileTab).not.toHaveAttribute('href');

    await user.click(profileTab);

    expect(profileTab).toHaveAttribute('aria-selected', 'true');
    expect(overviewTab).toHaveAttribute('aria-selected', 'false');
    expect(await screen.findByTestId('self-service-panel-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('self-service-overview')).not.toBeInTheDocument();
  });

  it('parses nullable current-person locale and renders My Profile instead of not-linked state', async () => {
    await renderRoute('/self-service', () =>
      setMockSelfServiceCurrentPerson({
        employmentProfileId: 'ep-linked-null-locale',
        employeeCode: 'EP-LINKED-NULL',
        displayName: 'Linked Null Locale Staff',
        employmentStatus: 'ACTIVE',
        accountEmail: 'linked.null.locale@example.test',
        accountStatus: 'ACTIVE',
        accountLinkStatus: 'LINKED',
        linkedInternalTalent: {
          talentId: 'talent-linked-null-locale',
          talentCode: 'TAL-LINKED-NULL',
          displayName: 'Linked Null Locale Staff',
          performanceAlias: null,
        },
        locale: null,
        timezone: 'Asia/Saigon',
      }),
    );

    await switchSelfServiceModule('profile');

    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeInTheDocument();
    expect((await screen.findAllByText('EP-LINKED-NULL')).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText('TAL-LINKED-NULL')).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('self-service-panel-kpi')).not.toBeInTheDocument();
    expect(screen.queryByText('No linked Employment Profile')).not.toBeInTheDocument();
  });

  it('renders no-linked profile state only for the backend self-service not-linked error', async () => {
    await renderRoute('/self-service', () => setMockSelfServiceCurrentPersonNotLinked());

    expect(await screen.findByText('No linked Employment Profile')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Your account is authenticated, but no staff profile is linked for self-service yet.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Self-Service is not available')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-profile-not-operational')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Profile' })).not.toBeInTheDocument();
  });

  it('renders blocked state for backend non-operational profile denial before loading panels', async () => {
    let workShiftCalls = 0;
    let eventCalls = 0;
    let kpiCalls = 0;
    let talentGroupCalls = 0;
    let preferencesCalls = 0;

    server.use(
      http.get('*/self-service/work-shifts', () => {
        workShiftCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
      http.get('*/self-service/events', () => {
        eventCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
      http.get('*/self-service/kpi', () => {
        kpiCalls += 1;
        return HttpResponse.json({ data: { items: [] } });
      }),
      http.get('*/self-service/talent-groups', () => {
        talentGroupCalls += 1;
        return HttpResponse.json({ data: { items: [] } });
      }),
      http.patch('*/self-service/account/preferences', () => {
        preferencesCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
    );

    await renderRoute('/self-service', () => setMockSelfServiceProfileNotOperational());

    expect(await screen.findByTestId('self-service-profile-not-operational')).toBeInTheDocument();
    expect(await screen.findByText('Access not available')).toBeInTheDocument();
    expect(await screen.findByText('Self-Service is not available')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Your employment profile is not currently eligible to use Self-Service. Contact HR/Admin if this needs to be reviewed.',
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Access is checked by the people system. This screen only shows the status and does not repair data.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('SELF_SERVICE_PROFILE_NOT_OPERATIONAL')).not.toBeInTheDocument();
    expect(screen.queryByText('No linked Employment Profile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-panel-profile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-panel-work')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-panel-kpi')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-panel-talentGroups')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-account-card')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /fix all|repair|backfill|payroll|attendance|commission/i,
      }),
    ).toBeNull();
    const blockedText =
      screen.getByTestId('self-service-profile-not-operational').textContent ?? '';
    expect(blockedText).not.toMatch(/suspended|terminated|archived|payroll|attendance|commission/i);
    expect(blockedText).not.toContain('SELF_SERVICE_PROFILE_NOT_OPERATIONAL');
    await waitFor(() => {
      expect(workShiftCalls).toBe(0);
      expect(eventCalls).toBe(0);
      expect(kpiCalls).toBe(0);
      expect(talentGroupCalls).toBe(0);
      expect(preferencesCalls).toBe(0);
    });
  });

  it('lands staff actors on the self-service blocked state without redirect loops', async () => {
    await renderRoute('/', () => setMockSelfServiceProfileNotOperational());

    expect(await screen.findByTestId('self-service-shell')).toBeInTheDocument();
    expect(await screen.findByTestId('self-service-profile-not-operational')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-service-overview')).not.toBeInTheDocument();
  });

  it('does not treat every current-person 403 as a non-operational profile block', async () => {
    server.use(
      http.get('*/self-service/me', () =>
        HttpResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'Permission denied',
            },
          },
          { status: 403 },
        ),
      ),
    );

    await renderRoute('/self-service');

    expect(await screen.findByText('Self-Service unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Your profile could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByTestId('self-service-profile-not-operational')).not.toBeInTheDocument();
    expect(screen.queryByText('Access not available')).not.toBeInTheDocument();
    expect(screen.queryByText('FORBIDDEN')).not.toBeInTheDocument();
  });

  it('has non-operational profile blocked-state copy in every self-service locale', async () => {
    const locales = ['en', 'vi', 'zh'] as const;
    const keys = [
      'errors.profileNotOperationalTitle',
      'errors.profileNotOperationalMessage',
      'errors.profileNotOperationalLabel',
      'errors.profileNotOperationalHelper',
    ];

    for (const locale of locales) {
      await setLocale(locale);
      useShellStore.getState().setLocale(locale);
      for (const key of keys) {
        const fullKey = `self-service:${key}`;
        expect(i18n.t(fullKey)).not.toBe(fullKey);
        expect(i18n.t(fullKey).trim()).not.toHaveLength(0);
      }
    }

    await setLocale('en');
    useShellStore.getState().setLocale('en');
  });

  it('renders generic current-person load errors for parse/client failures', async () => {
    server.use(
      http.get('*/self-service/me', () =>
        HttpResponse.json({
          data: {
            employmentProfileId: 'ep-invalid-current-person',
            employeeCode: 'EP-INVALID',
            displayName: 'Invalid Current Person',
            employmentStatus: 'ACTIVE',
            accountStatus: 'ACTIVE',
            accountLinkStatus: 'LINKED',
            locale: 42,
          },
        }),
      ),
    );

    await renderRoute('/self-service');

    expect(await screen.findByText('Self-Service unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Your profile could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('No linked Employment Profile')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Profile' })).not.toBeInTheDocument();
  });

  it('standardizes Self-Service identity, own-data scope, and module semantics in Vietnamese', async () => {
    const user = userEvent.setup();
    await renderRoute('/self-service');

    await act(async () => {
      await setLocale('vi');
    });

    expect(await screen.findByRole('heading', { name: 'Dữ liệu cá nhân' })).toBeInTheDocument();
    expect(screen.getAllByText('Mina Staff').length).toBeGreaterThan(0);
    expect(screen.getByText('Hồ sơ nhân sự · EP-SELF-001')).toBeInTheDocument();
    expect(screen.getAllByText('Dữ liệu của bạn').length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent('Không gian nhân sự');
    expect(document.body).not.toHaveTextContent(/workspace|console|account context/i);
    expect(screen.getByTestId('self-service-nav-profile')).toHaveTextContent('Chỉ đọc');
    expect(screen.getByTestId('self-service-nav-account')).toHaveTextContent(
      'Chỉ chỉnh tùy chọn',
    );
    expect(screen.getByTestId('self-service-nav-overview')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByTestId('self-service-nav-work'));
    expect(
      await screen.findByText(
        'Ca làm chính thức là kế hoạch làm việc, không phải chấm công hoặc bảng lương.',
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Hiển thị sự kiện trong 30 ngày trước và 90 ngày sắp tới/),
    ).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain(
      'Showing recent events from the previous',
    );

    await user.click(screen.getByTestId('self-service-nav-kpi'));
    expect(
      await screen.findByText('Số thực đạt không tự quyết định hoa hồng hoặc bảng lương.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Lịch sử KPI trước')).toBeInTheDocument();

    await user.click(screen.getByTestId('self-service-nav-account'));
    expect(await screen.findByRole('heading', { name: 'Tài khoản đăng nhập' })).toBeInTheDocument();
    expect((await screen.findAllByText('Giờ Việt Nam')).length).toBeGreaterThanOrEqual(1);
    expect(
      await screen.findByRole('heading', { name: 'Hồ sơ Talent đã liên kết' }),
    ).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain('Talent nội bộ liên kết');
    expect(document.body.textContent ?? '').not.toContain('Asia/Saigon');
    expect(document.body.textContent ?? '').not.toContain('Asia/Ho_Chi_Minh');

    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('Dang hien thi');
    expect(bodyText).not.toContain('Actual status summary');
    expect(bodyText).not.toContain('Previous KPI history');
    expect(bodyText).not.toContain('self-service:');
  });

  it('renders read-only My Work Shifts from the self-service endpoint only', async () => {
    let adminWorkShiftCalls = 0;

    server.use(
      http.get('*/admin/work-shifts*', () => {
        adminWorkShiftCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    await switchSelfServiceModule('work');

    expect(await screen.findByRole('heading', { name: 'My Work Shifts' })).toBeInTheDocument();
    expect(await screen.findByText('Studio filming shift')).toBeInTheDocument();
    expect(await screen.findByText('Content review shift')).toBeInTheDocument();
    expect(await screen.findByText('Roster generated')).toBeInTheDocument();
    expect(await screen.findByText('Manual')).toBeInTheDocument();
    expect(screen.getAllByTestId('self-service-work-shift-row')).toHaveLength(2);
    expect(document.body.textContent ?? '').not.toContain('Other Staff');
    expect(document.body.textContent ?? '').not.toContain('subjectEmploymentProfileId');
    expect(document.body.textContent ?? '').not.toContain('studioResourceIds');
    expect(document.body.textContent ?? '').not.toContain('internal admin note');
    expect(
      screen.queryByRole('button', { name: /create|edit|cancel|request|approve/i }),
    ).toBeNull();
    await waitFor(() => {
      expect(adminWorkShiftCalls).toBe(0);
    });
  });

  it('preserves My Work Shifts cursor metadata and loads the next page', async () => {
    const user = userEvent.setup();
    const requestedQueries: Array<{ cursor: string | null; status: string | null }> = [];

    setMockSelfServiceWorkShifts([]);
    server.use(
      http.get('*/self-service/work-shifts', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        const status = new URL(request.url).searchParams.get('status');
        requestedQueries.push({ cursor, status });

        if (status === 'CANCELLED') {
          return HttpResponse.json({
            data: [
              {
                workShiftId: 'shift-filtered-cancelled',
                title: 'Cancelled filtered shift',
                status: 'CANCELLED',
                startsAt: Date.UTC(2026, 4, 29, 2, 0),
                endsAt: Date.UTC(2026, 4, 29, 6, 0),
                sourceType: 'MANUAL',
              },
            ],
          });
        }

        if (cursor === 'cursor-page-2') {
          return HttpResponse.json({
            data: [
              {
                workShiftId: 'shift-page-2',
                title: 'Second page shift',
                status: 'ACTIVE',
                startsAt: Date.UTC(2026, 4, 28, 2, 0),
                endsAt: Date.UTC(2026, 4, 28, 6, 0),
                sourceType: 'MANUAL',
              },
            ],
          });
        }

        return HttpResponse.json({
          data: [
            {
              workShiftId: 'shift-page-1',
              title: 'First page shift',
              status: 'ACTIVE',
              startsAt: Date.UTC(2026, 4, 26, 2, 0),
              endsAt: Date.UTC(2026, 4, 26, 6, 0),
              sourceType: 'ROSTER_GENERATED',
            },
          ],
          meta: { nextCursor: 'cursor-page-2' },
        });
      }),
    );

    await renderRoute('/self-service');

    await user.click(await screen.findByTestId('self-service-nav-work'));

    expect(await screen.findByText('First page shift')).toBeInTheDocument();
    expect(screen.queryByText('Second page shift')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Second page shift')).toBeInTheDocument();
    expect(screen.getAllByTestId('self-service-work-shift-row')).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText('Official shift status'), 'CANCELLED');
    expect(await screen.findByText('Cancelled filtered shift')).toBeInTheDocument();
    expect(screen.queryByText('First page shift')).not.toBeInTheDocument();
    expect(screen.queryByText('Second page shift')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(requestedQueries).toEqual([
        { cursor: null, status: null },
        { cursor: 'cursor-page-2', status: null },
        { cursor: null, status: 'CANCELLED' },
      ]);
    });
  });

  it('renders empty Work Shifts and retries a recoverable own-data failure without mutation', async () => {
    const user = userEvent.setup();
    let calls = 0;

    setMockSelfServiceWorkShifts([]);
    server.use(
      http.get('*/self-service/work-shifts', () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { error: { code: 'UNAVAILABLE', message: 'Temporary failure' } },
            { status: 503 },
          );
        }

        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');
    await switchSelfServiceModule('work');

    expect(await screen.findByText('Work shifts unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No work shifts')).toBeInTheDocument();
    expect(calls).toBe(2);
    expect(screen.queryByRole('button', { name: /create|edit|approve|request/i })).toBeNull();
  });

  it('fails closed for denied and malformed WorkShift responses', async () => {
    server.use(
      http.get('*/self-service/work-shifts', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Permission denied' } },
          { status: 403 },
        ),
      ),
    );

    await renderRoute('/self-service');
    await switchSelfServiceModule('work');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('self-service-work-shift-row')).not.toBeInTheDocument();

    server.use(
      http.get('*/self-service/work-shifts', () =>
        HttpResponse.json({
          data: [
            {
              workShiftId: 'shift-unsafe',
              title: 'Unsafe shift',
              status: 'ACTIVE',
              startsAt: Date.UTC(2026, 4, 26, 2, 0),
              endsAt: Date.UTC(2026, 4, 26, 6, 0),
              sourceType: 'MANUAL',
              subjectEmploymentProfileId: 'ep-other',
            },
          ],
        }),
      ),
    );

    await renderRoute('/self-service');
    await switchSelfServiceModule('work');

    expect(await screen.findByText('Work shifts unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Unsafe shift')).not.toBeInTheDocument();
    expect(screen.queryByText('ep-other')).not.toBeInTheDocument();
  });

  it('does not render forbidden person, HR, Auth0, password setup, or role data', async () => {
    await renderRoute('/self-service');

    expect((await screen.findAllByText('Mina Staff')).length).toBeGreaterThanOrEqual(1);
    const bodyText = document.body.textContent ?? '';
    for (const forbidden of [
      'Mina Legal',
      'legalName',
      'recruiterEmploymentProfileId',
      'hrOwnerEmploymentProfileId',
      'onboardingOwnerEmploymentProfileId',
      'sourcedByEmploymentProfileId',
      'hiredAt',
      'onboardedAt',
      'auth0|',
      'setupUrl',
      'ticketUrl',
      'resetUrl',
      'temporaryPassword',
      'credential',
      'session',
      'role:list',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }
  });

  it('renders read-only My Events from the self-service endpoint only', async () => {
    let selfServiceEventCalls = 0;
    let adminEventCalls = 0;
    let kpiCalls = 0;

    server.use(
      http.get('*/self-service/events', () => {
        selfServiceEventCalls += 1;
        return HttpResponse.json({
          data: [
            {
              eventId: 'event-self-talent',
              eventCode: 'EVT-SELF-TAL',
              title: 'Creator livestream event',
              status: 'PLANNED',
              startsAt: Date.UTC(2026, 4, 28, 2, 0),
              endsAt: Date.UTC(2026, 4, 28, 4, 0),
              ownAssignmentKind: 'TALENT',
              ownAssignmentStatus: 'ACTIVE',
            },
          ],
          meta: {
            window: {
              recentPastDays: 30,
              upcomingDays: 90,
              windowStartAt: Date.UTC(2026, 3, 26, 0, 0),
              windowEndAt: Date.UTC(2026, 7, 24, 0, 0),
            },
            limit: 50,
            truncated: false,
          },
        });
      }),
      http.get('*/admin/events*', () => {
        adminEventCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
      http.get('*/admin/kpi*', () => {
        kpiCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    await switchSelfServiceModule('work');

    expect(await screen.findByTestId('self-service-nav-work')).toHaveTextContent('Selected');
    expect(await screen.findByTestId('self-service-nav-kpi')).toHaveTextContent('Read-only');
    expect(await screen.findByRole('heading', { name: 'My Events' })).toBeInTheDocument();
    expect(await screen.findByText('EVT-SELF-TAL')).toBeInTheDocument();
    expect(await screen.findByText('Creator livestream event')).toBeInTheDocument();
    expect(
      await screen.findByText(/Showing recent events from the previous 30 days/),
    ).toBeInTheDocument();
    expect(await screen.findByText('Talent')).toBeInTheDocument();
    expect(screen.getAllByTestId('self-service-event-row')).toHaveLength(1);
    await waitFor(() => {
      expect(selfServiceEventCalls).toBe(1);
      expect(adminEventCalls).toBe(0);
      expect(kpiCalls).toBe(0);
    });
    const bodyText = document.body.textContent ?? '';
    for (const forbidden of [
      'Other staff event',
      'TalentGroup-only event',
      'External Talent event',
      'Removed assignment event',
      'full roster',
      'participantRoster',
      'Internal production note',
      'client budget',
      'commercial confidential',
      'platform-secret-account',
      'studioResourceIds',
      'externalRef',
      'manager only note',
      'PENDING_APPROVAL',
      'legacy Active',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }
    expect(
      screen.queryByRole('button', {
        name: /create|edit|delete|assign|accept|decline|check[- ]?in|request|change|start|complete|cancel/i,
      }),
    ).toBeNull();
  });

  it('renders My Events truncation copy when the self-service events response is capped', async () => {
    let adminEventCalls = 0;

    server.use(
      http.get('*/self-service/events', () =>
        HttpResponse.json({
          data: [
            {
              eventId: 'event-capped',
              eventCode: 'EVT-CAPPED',
              title: 'Capped visible event',
              status: 'PLANNED',
              startsAt: Date.UTC(2026, 4, 28, 2, 0),
              endsAt: Date.UTC(2026, 4, 28, 4, 0),
              ownAssignmentKind: 'EMPLOYMENT_PROFILE',
              ownAssignmentStatus: 'ACTIVE',
            },
          ],
          meta: {
            window: {
              recentPastDays: 30,
              upcomingDays: 90,
              windowStartAt: Date.UTC(2026, 3, 26, 0, 0),
              windowEndAt: Date.UTC(2026, 7, 24, 0, 0),
            },
            limit: 1,
            truncated: true,
          },
        }),
      ),
      http.get('*/admin/events*', () => {
        adminEventCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    await switchSelfServiceModule('work');

    expect(await screen.findByText('EVT-CAPPED')).toBeInTheDocument();
    expect(await screen.findByText('Capped visible event')).toBeInTheDocument();
    expect(
      await screen.findByText(/Showing recent events from the previous 30 days/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /Some events are not shown because the bounded Stage 1 list limit was reached\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('self-service-event-row')).toHaveLength(1);
    expect(
      screen.queryByRole('button', {
        name: /create|edit|delete|assign|accept|decline|check[- ]?in|request|change|start|complete|cancel/i,
      }),
    ).toBeNull();
    await waitFor(() => {
      expect(adminEventCalls).toBe(0);
    });
  });

  it('renders read-only ORG_UNIT My KPI from the self-service safe envelope only', async () => {
    let selfServiceKpiCalls = 0;
    let adminKpiCalls = 0;
    const orgUnitCurrent = makeSelfServiceKpiItem({
      kpiPlanId: 'kpi-plan-self-org-unit-current',
      title: 'June operations KPI',
      periodMonth: '2026-06',
      metrics: [
        {
          metricCode: 'REVENUE_VND',
          unit: 'VND',
          targetValue: 25000000,
          actualValue: 12500000,
          progressPercent: 45,
        },
      ],
    });

    server.use(
      http.get('*/self-service/kpi', () => {
        selfServiceKpiCalls += 1;
        return HttpResponse.json({
          data: {
            items: [orgUnitCurrent],
            current: orgUnitCurrent,
            latestPrevious: null,
            history: [],
          },
        });
      }),
      http.get('*/admin/kpi*', () => {
        adminKpiCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    await switchSelfServiceModule('kpi');

    expect(await screen.findByRole('heading', { name: 'My KPI' })).toBeInTheDocument();
    expect(await screen.findByText('June operations KPI')).toBeInTheDocument();
    expect(await screen.findByText('Official published')).toBeInTheDocument();
    expect(await screen.findByText('Operational revenue KPI')).toBeInTheDocument();
    expect(screen.queryByText(/Talent KPI/i)).not.toBeInTheDocument();
    expect(screen.queryByText('TikTok Diamond count')).not.toBeInTheDocument();
    expect(screen.queryByText('TIKTOK_DIAMOND')).not.toBeInTheDocument();
    expect(await screen.findByText('45%')).toBeInTheDocument();
    expect(screen.getAllByTestId('self-service-kpi-item')).toHaveLength(1);
    expect(screen.getAllByTestId('self-service-kpi-metric-row')).toHaveLength(1);

    await waitFor(() => {
      expect(selfServiceKpiCalls).toBe(1);
      expect(adminKpiCalls).toBe(0);
    });

    const bodyText = (document.body.textContent ?? '').replace(
      'Actual results do not automatically determine commission or payroll.',
      '',
    );
    for (const forbidden of [
      'Own DRAFT KPI allocation',
      'Own pending KPI allocation',
      'Own approved KPI allocation',
      'Own rejected KPI allocation',
      'Own legacy active KPI allocation',
      'Other member published KPI allocation',
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'ACTIVE allocation',
      'Other Staff',
      'group total',
      'manager note',
      'approval note',
      'submittedByActorId',
      'approvedByActorId',
      'publishedByActorId',
      'subjectType',
      'subjectRef',
      'ORG_UNIT',
      'finalResult',
      'payroll',
      'bonus',
      'commission',
      'finance',
      'commercial',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }

    expect(
      screen.queryByRole('button', {
        name: /enter|actual|correct|correction|approve|publish|submit|reject|edit|request/i,
      }),
    ).toBeNull();
  });

  it('renders TALENT_GROUP TikTok Diamond as count, not VND revenue', async () => {
    const diamondCurrent = makeSelfServiceKpiItem({
      kpiPlanId: 'kpi-plan-talent-group-diamond',
      title: 'June creator group KPI',
      metrics: [
        {
          metricCode: 'TIKTOK_DIAMOND',
          unit: 'COUNT',
          targetValue: 1000,
          actualValue: 840,
          progressPercent: 84,
        },
      ],
    });

    await renderRoute('/self-service', () =>
      setMockSelfServiceKpi({
        items: [diamondCurrent],
        current: diamondCurrent,
        latestPrevious: null,
        history: [],
      }),
    );

    await switchSelfServiceModule('kpi');

    expect(await screen.findByText('June creator group KPI')).toBeInTheDocument();
    expect(await screen.findByText('TikTok Diamond count')).toBeInTheDocument();
    expect(screen.getByText('1.000 count')).toBeInTheDocument();
    expect(screen.getByText('840 count')).toBeInTheDocument();
    expect(screen.queryByText('840 VND')).not.toBeInTheDocument();
    expect(screen.queryByText(/revenue/i)).not.toBeInTheDocument();
    expect(
      (document.body.textContent ?? '').replace(
        'Actual results do not automatically determine commission or payroll.',
        '',
      ),
    ).not.toMatch(/payroll|commission|payout|ledger/i);
  });

  it('strict Self-Service KPI schema rejects unknown metrics and unsafe internals', () => {
    const safeItem = makeSelfServiceKpiItem({
      kpiPlanId: 'kpi-plan-schema-safe',
      title: 'Schema safe KPI',
    });

    expect(() =>
      parseSelfServiceKpiResponseForTest({
        data: {
          items: [
            {
              ...safeItem,
              metrics: [
                {
                  metricCode: 'UNKNOWN_METRIC',
                  unit: 'COUNT',
                  targetValue: 1,
                  actualValue: 0,
                  progressPercent: 0,
                },
              ],
            },
          ],
          current: null,
          latestPrevious: null,
          history: [],
        },
      }),
    ).toThrow();

    for (const forbidden of [
      'memberEmploymentProfileId',
      'memberTalentId',
      'subjectType',
      'subjectRef',
      'finalResult',
    ]) {
      expect(() =>
        parseSelfServiceKpiResponseForTest({
          data: {
            items: [{ ...safeItem, [forbidden]: 'unsafe-internal' }],
            current: null,
            latestPrevious: null,
            history: [],
          },
        }),
      ).toThrow();
    }
  });

  it('renders ORG_UNIT current KPI and navigates previous KPI history by period safely', async () => {
    const user = userEvent.setup();
    let adminKpiCalls = 0;
    let actualExcuseCalls = 0;
    const current = makeSelfServiceKpiItem({
      kpiPlanId: 'kpi-plan-current-june',
      title: 'June operations KPI',
      periodMonth: '2026-06',
    });
    const latestPrevious = makeSelfServiceKpiItem({
      kpiPlanId: 'kpi-plan-previous-may',
      planCode: 'KPI-SELF-202605',
      title: 'May operations KPI',
      periodMonth: '2026-05',
      isCurrentPeriod: false,
      isPreviousPeriod: true,
      actualEntryStatusSummary: {
        expectedEntryCount: 60,
        enteredEntryCount: 58,
        enteredZeroCount: 2,
        pendingEntryCount: 0,
        overdueEntryCount: 0,
        excusedEntryCount: 1,
        notRequiredEntryCount: 1,
        notDueEntryCount: 0,
      },
    });
    const finalizedPrevious = makeSelfServiceKpiItem({
      kpiPlanId: 'kpi-plan-previous-april',
      planCode: 'KPI-SELF-202604',
      title: 'April operations KPI',
      periodMonth: '2026-04',
      officialStatus: 'OFFICIAL_FINALIZED',
      isCurrentPeriod: false,
      isPreviousPeriod: true,
      actualEntryStatusSummary: {
        expectedEntryCount: 62,
        enteredEntryCount: 62,
        enteredZeroCount: 0,
        pendingEntryCount: 0,
        overdueEntryCount: 0,
        excusedEntryCount: 0,
        notRequiredEntryCount: 0,
        notDueEntryCount: 0,
      },
    });

    await renderRoute('/self-service', () => {
      setMockSelfServiceKpi({
        items: [current],
        current,
        latestPrevious,
        history: [latestPrevious, finalizedPrevious, current],
      });
      server.use(
        http.get('*/admin/kpi*', () => {
          adminKpiCalls += 1;
          return HttpResponse.json({ data: [] });
        }),
        http.all('*/admin/kpi/plans/:kpiPlanId/actual-excuses*', () => {
          actualExcuseCalls += 1;
          return HttpResponse.json({ data: [] });
        }),
      );
    });

    await switchSelfServiceModule('kpi');

    expect(await screen.findByText('June operations KPI')).toBeInTheDocument();
    expect(screen.getByText('Current period')).toBeInTheDocument();
    expect(screen.getByText('Previous KPI history')).toBeInTheDocument();
    expect(screen.getByText('May operations KPI')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('self-service-kpi-current')).getByText('June operations KPI'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('self-service-kpi-current')).queryByText('May operations KPI'),
    ).toBeNull();

    const historyPanel = within(screen.getByTestId('self-service-kpi-history'));
    const periodSelect = historyPanel.getByTestId('self-service-kpi-history-period-select');
    expect(periodSelect).toHaveValue('2026-05');
    expect(within(periodSelect).getByRole('option', { name: '05-2026' })).toBeInTheDocument();
    expect(within(periodSelect).getByRole('option', { name: '04-2026' })).toBeInTheDocument();
    expect(within(periodSelect).queryByRole('option', { name: '06-2026' })).toBeNull();
    expect(
      historyPanel.getByText('Showing 1 previous KPI record(s) for 05-2026.'),
    ).toBeInTheDocument();

    let historyCards = historyPanel.getAllByTestId('self-service-kpi-item');
    expect(historyCards).toHaveLength(1);
    expect(historyCards[0]).toHaveTextContent('May operations KPI');
    expect(historyPanel.queryByText('April operations KPI')).toBeNull();

    await user.selectOptions(periodSelect, '2026-04');

    expect(periodSelect).toHaveValue('2026-04');
    expect(historyPanel.getByText('April operations KPI')).toBeInTheDocument();
    expect(historyPanel.getByText('Official finalized')).toBeInTheDocument();
    expect(historyPanel.queryByText('May operations KPI')).toBeNull();
    expect(
      historyPanel.getByText('Showing 1 previous KPI record(s) for 04-2026.'),
    ).toBeInTheDocument();
    historyCards = historyPanel.getAllByTestId('self-service-kpi-item');
    expect(historyCards).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();

    const currentSummary = within(screen.getAllByTestId('self-service-kpi-status-summary')[0]);
    expect(currentSummary.getByText('Actual status summary')).toBeInTheDocument();
    expect(
      currentSummary.getByText('Status is based on manager-entered daily actuals. Read-only.'),
    ).toBeInTheDocument();
    expect(currentSummary.getByText('Entered zero')).toBeInTheDocument();
    expect(currentSummary.getByText('Overdue')).toBeInTheDocument();
    expect(currentSummary.getByText('Excused')).toBeInTheDocument();
    expect(currentSummary.getByText('Not required')).toBeInTheDocument();
    expect(currentSummary.getAllByText('1').length).toBeGreaterThanOrEqual(3);
    expect(currentSummary.getByText('2')).toBeInTheDocument();

    const bodyText = document.body.textContent ?? '';
    for (const forbidden of [
      'memberTalentId',
      'memberEmploymentProfileId',
      'allocationId',
      'submittedByActorId',
      'approvedByActorId',
      'actualExcuse',
      'actorId',
      'subjectType',
      'subjectRef',
      'finalResult',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }
    expect(
      screen.queryByRole('button', {
        name: /enter|actual|correct|correction|mark|unmark|excuse|approve|publish|submit|reject|edit|request/i,
      }),
    ).toBeNull();
    await waitFor(() => {
      expect(adminKpiCalls).toBe(0);
      expect(actualExcuseCalls).toBe(0);
    });
  });

  it('keeps current separate from previous and shows latest previous only as read-only context', async () => {
    const latestPrevious = makeSelfServiceKpiItem({
      kpiPlanId: 'kpi-plan-previous-only',
      title: 'May operations KPI',
      periodMonth: '2026-05',
      isCurrentPeriod: false,
      isPreviousPeriod: true,
    });

    await renderRoute('/self-service', () =>
      setMockSelfServiceKpi({
        items: [],
        current: null,
        latestPrevious,
        history: [latestPrevious],
      }),
    );

    await switchSelfServiceModule('kpi');

    expect(
      await screen.findByText('No official KPI is published for the current period.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your latest previous KPI is shown below for read-only context. If you believe a current KPI allocation is missing, contact your manager or admin.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('self-service-kpi-latest-previous')).toHaveTextContent(
      'May operations KPI',
    );
    expect(screen.getAllByText('Previous period').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Not current KPI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Read-only').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText('No current-period KPI has been published yet.'),
    ).not.toBeInTheDocument();
  });

  it('uses items only as old-shape current compatibility and does not invent previous history', async () => {
    server.use(
      http.get('*/self-service/kpi', () =>
        HttpResponse.json({
          data: {
            items: [
              {
                kpiPlanId: 'kpi-plan-old-shape',
                title: 'Old shape current KPI',
                periodMonth: '2026-06',
                periodStartAt: Date.UTC(2026, 5, 1, -7, 0),
                periodEndAt: Date.UTC(2026, 6, 1, -7, 0) - 1,
                officialStatus: 'OFFICIAL_PUBLISHED',
                lastUpdatedAt: Date.UTC(2026, 5, 10, 4, 0),
                metrics: [
                  {
                    metricCode: 'LIVE_HOURS',
                    unit: 'HOUR',
                    targetValue: 40,
                    actualValue: 20,
                    progressPercent: 50,
                  },
                ],
              },
            ],
          },
        }),
      ),
    );

    await renderRoute('/self-service');

    await switchSelfServiceModule('kpi');

    expect(await screen.findByText('Old shape current KPI')).toBeInTheDocument();
    expect(screen.getByText('Current period')).toBeInTheDocument();
    expect(screen.getByText('No previous KPI history')).toBeInTheDocument();
    expect(screen.getAllByTestId('self-service-kpi-item')).toHaveLength(1);
  });

  it('renders read-only My Talent Groups from the self-service endpoint only', async () => {
    let selfServiceTalentGroupCalls = 0;
    let adminTalentGroupCalls = 0;
    let adminTalentCalls = 0;

    server.use(
      http.get('*/self-service/talent-groups', () => {
        selfServiceTalentGroupCalls += 1;
        return HttpResponse.json({
          data: {
            items: [
              {
                talentGroupCode: 'TG-SELF-001',
                name: 'Creator Team',
                status: 'ACTIVE',
                managers: [{ displayName: 'Mai Manager', employeeCode: 'EP-MGR-001' }],
                members: [
                  {
                    talentCode: 'TAL-SELF-001',
                    displayName: 'Mina Staff',
                    performanceAlias: 'Creator Mina',
                    origin: 'INTERNAL',
                  },
                  {
                    talentCode: 'EXT-SELF-001',
                    displayName: 'External Guest',
                    performanceAlias: 'Guest Alias',
                    origin: 'EXTERNAL',
                  },
                ],
              },
            ],
          },
        });
      }),
      http.get('*/admin/talent-groups*', () => {
        adminTalentGroupCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
      http.get('*/admin/talents*', () => {
        adminTalentCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    await switchSelfServiceModule('talentGroups');

    expect(await screen.findByTestId('self-service-nav-talentGroups')).toHaveTextContent(
      'Selected',
    );
    expect(await screen.findByRole('heading', { name: 'My Talent Groups' })).toBeInTheDocument();
    expect(await screen.findByText('Creator Team')).toBeInTheDocument();
    expect(await screen.findByText('TG-SELF-001')).toBeInTheDocument();
    expect(await screen.findByText('Mai Manager')).toBeInTheDocument();
    expect(await screen.findByText('EP-MGR-001')).toBeInTheDocument();
    expect(await screen.findByText('External Guest')).toBeInTheDocument();
    expect(screen.getAllByTestId('self-service-talent-group-card')).toHaveLength(1);
    expect(screen.getAllByTestId('self-service-talent-group-member')).toHaveLength(2);
    expect(document.body.textContent ?? '').toContain('Guest Alias');

    await waitFor(() => {
      expect(selfServiceTalentGroupCalls).toBe(1);
      expect(adminTalentGroupCalls).toBe(0);
      expect(adminTalentCalls).toBe(0);
    });

    const bodyText = document.body.textContent ?? '';
    for (const forbidden of [
      'group-001',
      'talent-self',
      'managerEmploymentProfileId',
      'assignmentId',
      'effectiveFrom',
      'effectiveTo',
      'legalName',
      'linkedUserId',
      'auth0|',
      'subject',
      'role',
      'scopeGrants',
      'KPI progress',
      'WorkShift',
      'Event roster',
      'platform',
      'finance',
      'commercial',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }

    expect(
      screen.queryByRole('button', {
        name: /join|leave|edit|assign|revoke|member|manager|contact|details/i,
      }),
    ).toBeNull();
  });

  it('renders Talent Group truncation copy from self-service metadata', async () => {
    server.use(
      http.get('*/self-service/talent-groups', () =>
        HttpResponse.json({
          data: {
            items: [
              {
                talentGroupCode: 'TG-CAPPED',
                name: 'Capped Team',
                status: 'ACTIVE',
                managers: Array.from({ length: 5 }, (_, index) => ({
                  displayName: `Manager ${index + 1}`,
                })),
                members: Array.from({ length: 50 }, (_, index) => ({
                  talentCode: `TAL-${index + 1}`,
                  displayName: `Member ${index + 1}`,
                  origin: 'INTERNAL',
                })),
                managersTruncated: true,
                maxManagers: 5,
                membersTruncated: true,
                maxMembers: 50,
              },
            ],
            meta: {
              groupsTruncated: true,
              maxGroups: 10,
            },
          },
        }),
      ),
    );

    await renderRoute('/self-service');

    await switchSelfServiceModule('talentGroups');

    expect(
      await screen.findByText('Showing the first 10 active Talent Groups.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Showing the first 5 managers for this group.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Showing the first 50 members for this group.'),
    ).toBeInTheDocument();
  });

  it('renders My KPI empty, loading, and error states safely', async () => {
    await renderRoute('/self-service', () => setMockSelfServiceKpi([]));

    await switchSelfServiceModule('kpi');

    expect(
      await screen.findByText('No official KPI is published for the current period.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'If you believe a KPI allocation is missing, contact your manager or admin.',
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Previous KPI history is not available yet.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('No previous KPI history')).toBeInTheDocument();

    let resolveKpi: () => void = () => {};
    const pendingKpi = new Promise<void>((resolve) => {
      resolveKpi = resolve;
    });
    server.use(
      http.get('*/self-service/kpi', async () => {
        await pendingKpi;
        return HttpResponse.json({
          data: { items: [], current: null, latestPrevious: null, history: [] },
        });
      }),
    );

    await renderRoute('/self-service');
    await switchSelfServiceModule('kpi');
    expect(await screen.findByTestId('self-service-kpi-loading')).toBeInTheDocument();
    resolveKpi();
    await waitFor(() => {
      expect(screen.queryByTestId('self-service-kpi-loading')).not.toBeInTheDocument();
    });

    server.use(
      http.get('*/self-service/kpi', () => {
        return HttpResponse.json({ error: { code: 'TEST_ERROR' } }, { status: 500 });
      }),
    );

    await renderRoute('/self-service');
    await switchSelfServiceModule('kpi');
    expect(await screen.findByText('KPI unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Your official KPI could not be loaded.')).toBeInTheDocument();
  });

  it('renders My Talent Groups empty, loading, and error states safely', async () => {
    await renderRoute('/self-service', () => setMockSelfServiceTalentGroups([]));

    await switchSelfServiceModule('talentGroups');

    expect(await screen.findByText('No Talent Groups')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'No active Talent Group memberships are available for your linked internal Talent yet.',
      ),
    ).toBeInTheDocument();

    let resolveTalentGroups: () => void = () => {};
    const pendingTalentGroups = new Promise<void>((resolve) => {
      resolveTalentGroups = resolve;
    });
    server.use(
      http.get('*/self-service/talent-groups', async () => {
        await pendingTalentGroups;
        return HttpResponse.json({ data: { items: [] } });
      }),
    );

    await renderRoute('/self-service');
    await switchSelfServiceModule('talentGroups');
    expect(await screen.findByTestId('self-service-talent-groups-loading')).toBeInTheDocument();
    resolveTalentGroups();
    await waitFor(() => {
      expect(screen.queryByTestId('self-service-talent-groups-loading')).not.toBeInTheDocument();
    });

    server.use(
      http.get('*/self-service/talent-groups', () => {
        return HttpResponse.json({ error: { code: 'TEST_ERROR' } }, { status: 500 });
      }),
    );

    await renderRoute('/self-service');
    await switchSelfServiceModule('talentGroups');
    expect(await screen.findByText('Talent Groups unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Your Talent Groups could not be loaded.')).toBeInTheDocument();
  });

  it('renders My Events empty, loading, and error states safely', async () => {
    await renderRoute('/self-service', () => setMockSelfServiceEvents([]));

    await switchSelfServiceModule('work');

    expect(await screen.findByText('No events')).toBeInTheDocument();
    expect(
      await screen.findByText('No directly assigned events are available for your profile yet.'),
    ).toBeInTheDocument();

    let resolveEvents: () => void = () => {};
    const pendingEvents = new Promise<void>((resolve) => {
      resolveEvents = resolve;
    });
    server.use(
      http.get('*/self-service/events', async () => {
        await pendingEvents;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');
    await switchSelfServiceModule('work');
    expect(await screen.findByTestId('self-service-events-loading')).toBeInTheDocument();
    resolveEvents();
    await waitFor(() => {
      expect(screen.queryByTestId('self-service-events-loading')).not.toBeInTheDocument();
    });

    server.use(
      http.get('*/self-service/events', () => {
        return HttpResponse.json({ error: { code: 'TEST_ERROR' } }, { status: 500 });
      }),
    );

    await renderRoute('/self-service');
    await switchSelfServiceModule('work');
    expect(await screen.findByText('Events unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Your events could not be loaded.')).toBeInTheDocument();
  });

  it('renders Account preferences form for locale and timezone only', async () => {
    const user = userEvent.setup();
    let adminUserCalls = 0;
    let preferencePatchCalls = 0;
    server.use(
      http.all('*/admin/users*', () => {
        adminUserCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
      http.patch('*/self-service/account/preferences', () => {
        preferencePatchCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
    );

    await renderRoute('/self-service');

    await switchSelfServiceModule('account');

    expect(await screen.findByTestId('self-service-account-card')).toBeInTheDocument();
    const preferencesForm = await screen.findByTestId('self-service-account-preferences-form');
    expect(preferencesForm).toBeInTheDocument();
    expect(await screen.findByTestId('self-service-nav-account')).toHaveTextContent('Selected');
    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(await screen.findByText('mina.staff@example.test')).toBeInTheDocument();
    expect((await screen.findAllByText('Linked')).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText('Vietnam time')).length).toBeGreaterThanOrEqual(1);
    expect(
      within(preferencesForm).getByTestId('self-service-account-locale-select'),
    ).toBeInTheDocument();
    expect(
      within(preferencesForm).getByTestId('self-service-account-timezone-select'),
    ).toBeInTheDocument();
    expect(
      within(preferencesForm).getByTestId('self-service-account-save-preferences'),
    ).toBeDisabled();
    expect(within(preferencesForm).getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(document.body.textContent ?? '').not.toContain('Asia/Saigon');
    expect(document.body.textContent ?? '').not.toContain('Asia/Ho_Chi_Minh');
    expect(document.body.textContent ?? '').not.toContain('America/New_York');
    expect(document.body.textContent ?? '').not.toContain('America/Los_Angeles');
    expect(document.body.textContent ?? '').not.toMatch(/\bUTC\b/);
    expect(
      screen.queryByRole('button', {
        name: /change email|change password|reset password|setup|link|unlink/i,
      }),
    ).toBeNull();
    expect(screen.queryByLabelText(/email|phone|address|display name|legal name/i)).toBeNull();

    const bodyText = document.body.textContent ?? '';
    for (const forbidden of [
      'auth0|',
      'setupUrl',
      'ticketUrl',
      'resetUrl',
      'temporaryPassword',
      'credential',
      'session',
      'token',
      'cookie',
      'role:list',
      'scopeGrants',
      'legalName',
      'hrOwnerEmploymentProfileId',
      'recruiterEmploymentProfileId',
      'managerEmploymentProfileId',
      'orgUnitId',
      'Change email',
      'Change password',
      'Reset password',
      'Edit phone',
      'Edit address',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }

    expect(bodyText).toContain('To change your password, contact IT/Admin.');
    expect(bodyText).toContain(
      'For email, phone, address, legal, contract, or staff record changes, contact the responsible HR/Admin/IT team.',
    );

    const timezoneSelect = within(preferencesForm).getByTestId(
      'self-service-account-timezone-select',
    );
    await user.selectOptions(timezoneSelect, 'Asia/Ho_Chi_Minh');
    expect(timezoneSelect).toHaveValue('Asia/Ho_Chi_Minh');
    await user.click(within(preferencesForm).getByRole('button', { name: 'Reset' }));
    expect(timezoneSelect).toHaveValue('Asia/Saigon');

    await waitFor(() => {
      expect(adminUserCalls).toBe(0);
      expect(preferencePatchCalls).toBe(0);
    });
  });

  it('saves only self-service locale and timezone preferences without admin User API calls', async () => {
    const user = userEvent.setup();
    const patchBodies: unknown[] = [];
    let adminUserCalls = 0;

    server.use(
      http.patch('*/self-service/account/preferences', async ({ request }) => {
        const body = await request.json();
        patchBodies.push(body);
        return HttpResponse.json({
          data: {
            employmentProfileId: 'ep-self',
            employeeCode: 'EP-SELF-001',
            displayName: 'Mina Staff',
            employmentStatus: 'ACTIVE',
            accountEmail: 'mina.staff@example.test',
            accountStatus: 'ACTIVE',
            accountLinkStatus: 'LINKED',
            linkedInternalTalent: {
              talentId: 'talent-self',
              talentCode: 'TAL-SELF-001',
              displayName: 'Mina Staff',
              performanceAlias: 'Creator Mina',
            },
            locale: 'vi',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        });
      }),
      http.all('*/admin/users*', () => {
        adminUserCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    await user.click(await screen.findByTestId('self-service-nav-account'));

    const preferencesForm = await screen.findByTestId('self-service-account-preferences-form');
    await user.selectOptions(
      within(preferencesForm).getByTestId('self-service-account-locale-select'),
      'vi',
    );
    await user.selectOptions(
      within(preferencesForm).getByTestId('self-service-account-timezone-select'),
      'Asia/Ho_Chi_Minh',
    );
    await user.click(within(preferencesForm).getByTestId('self-service-account-save-preferences'));

    await waitFor(() => {
      expect(patchBodies).toEqual([{ locale: 'vi', timezone: 'Asia/Ho_Chi_Minh' }]);
      expect(adminUserCalls).toBe(0);
    });
    expect(await screen.findByText('Preferences saved.')).toBeInTheDocument();
    expect(screen.getByText('Current timezone: Vietnam time')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain('Asia/Ho_Chi_Minh');
  });

  it('keeps the shared locale switcher available without admin User API calls', async () => {
    const user = userEvent.setup();
    const patchBodies: unknown[] = [];
    let adminUserCalls = 0;

    server.use(
      http.patch('*/self-service/account/preferences', async ({ request }) => {
        const body = await request.json();
        patchBodies.push(body);
        return HttpResponse.json({
          data: {
            employmentProfileId: 'ep-self',
            employeeCode: 'EP-SELF-001',
            displayName: 'Mina Staff',
            employmentStatus: 'ACTIVE',
            accountEmail: 'mina.staff@example.test',
            accountStatus: 'ACTIVE',
            accountLinkStatus: 'LINKED',
            linkedInternalTalent: {
              talentId: 'talent-self',
              talentCode: 'TAL-SELF-001',
              displayName: 'Mina Staff',
              performanceAlias: 'Creator Mina',
            },
            locale: 'zh',
            timezone: 'Asia/Saigon',
          },
        });
      }),
      http.all('*/admin/users*', () => {
        adminUserCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    const localeControl = await screen.findByTestId('self-service-locale-control');
    const localeSelect = within(localeControl).getByRole('combobox');
    await user.selectOptions(localeSelect, 'zh');

    await waitFor(() => {
      expect(patchBodies).toEqual([]);
      expect(adminUserCalls).toBe(0);
      expect(localeSelect).toHaveValue('zh');
    });
    expect(await screen.findByRole('heading', { name: '个人数据' })).toBeInTheDocument();
    await act(async () => {
      await setLocale('en');
      useShellStore.getState().setLocale('en');
    });
  });

  it('shows a safe preferences validation error and does not expose forbidden mutation fields', async () => {
    const user = userEvent.setup();

    server.use(
      http.patch('*/self-service/account/preferences', () =>
        HttpResponse.json(
          {
            error: {
              code: 'SELF_SERVICE_VALIDATION_ERROR',
              message: 'Invalid self-service request',
            },
          },
          { status: 400 },
        ),
      ),
    );

    await renderRoute('/self-service');

    await user.click(await screen.findByTestId('self-service-nav-account'));

    const preferencesForm = await screen.findByTestId('self-service-account-preferences-form');
    await user.selectOptions(
      within(preferencesForm).getByTestId('self-service-account-locale-select'),
      'zh',
    );
    await user.click(within(preferencesForm).getByTestId('self-service-account-save-preferences'));

    expect(await within(preferencesForm).findByRole('alert')).toBeInTheDocument();
    const bodyText = document.body.textContent ?? '';
    for (const forbidden of ['userId', 'employmentProfileId', 'role', 'scope', 'auth0']) {
      expect(bodyText).not.toContain(forbidden);
    }
  });

  it('shows a logout button that uses the existing auth logout flow', async () => {
    await renderRoute('/self-service');

    const user = userEvent.setup();
    const logoutButton = await screen.findByRole('button', { name: /log\s*out/i });
    await user.click(logoutButton);

    await waitFor(() => {
      expect(mockAuthAdapter.logoutRedirect).toHaveBeenCalledWith('/');
    });
  });

  it('keeps TALENT_STAFF_SELF denied from People Hub admin EmploymentProfile route', async () => {
    await renderRoute('/employment-profiles/ep-001');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('People Operations Hub')).not.toBeInTheDocument();
  });

  it('keeps TALENT_STAFF_SELF denied from the admin Event Assignment route', async () => {
    await renderRoute('/events');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('Event Assignment')).not.toBeInTheDocument();
  });

  it('keeps TALENT_STAFF_SELF denied from raw Admin WorkSchedule routes without self-service redirect', async () => {
    let adminWorkShiftCalls = 0;
    server.use(
      http.get('*/admin/work-shifts*', () => {
        adminWorkShiftCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/work-schedule/my-shifts');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('self-service-shell')).not.toBeInTheDocument();
    expect(screen.queryByText('Studio filming shift')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(adminWorkShiftCalls).toBe(0);
    });
  });

  it('keeps TALENT_STAFF_SELF denied from the Admin KPI route without self-service redirect', async () => {
    let adminKpiCalls = 0;
    server.use(
      http.get('*/admin/kpi*', () => {
        adminKpiCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/kpi');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('self-service-shell')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My KPI' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(adminKpiCalls).toBe(0);
    });
  });

  it('keeps TALENT_STAFF_SELF denied from raw Admin KPI detail without self-service redirect', async () => {
    let adminKpiCalls = 0;
    server.use(
      http.get('*/admin/kpi*', () => {
        adminKpiCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/kpi/plans/kpi-plan-self-org-unit-current');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('self-service-shell')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My KPI' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(adminKpiCalls).toBe(0);
    });
  });
});
