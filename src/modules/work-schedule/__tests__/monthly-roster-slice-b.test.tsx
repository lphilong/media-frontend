import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { server } from '@test/msw/server';
import { renderAppWithProviders } from '@test/render-app-route';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
  return router;
};

const rosterPlanningWindow = (): { current: string; max: string; beyond: string } => {
  const vietnamNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const current = `${vietnamNow.getUTCFullYear()}-${String(vietnamNow.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}`;
  const toMonth = (offset: number): string => {
    const date = new Date(
      Date.UTC(vietnamNow.getUTCFullYear(), vietnamNow.getUTCMonth() + offset, 1),
    );
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  return { current, max: toMonth(2), beyond: toMonth(3) };
};

const findPicker = async (pickerId: string): Promise<HTMLElement> => {
  await waitFor(() => {
    expect(
      screen
        .getAllByTestId('picker-surface')
        .some((surface) => surface.getAttribute('data-picker-id') === pickerId),
    ).toBe(true);
  });
  const picker = screen
    .getAllByTestId('picker-surface')
    .find((surface) => surface.getAttribute('data-picker-id') === pickerId);
  if (!picker) {
    throw new Error(`Picker not found: ${pickerId}`);
  }
  return picker;
};

const selectPickerOption = async (
  user: ReturnType<typeof userEvent.setup>,
  pickerId: string,
  optionText: RegExp,
): Promise<void> => {
  const picker = await findPicker(pickerId);
  await user.click(await within(picker).findByText(optionText));
};

const useRosterReferenceHandlers = (capturedKeys?: Record<string, string[]>) => {
  server.use(
    http.get('*/admin/org-units', ({ request }) => {
      const url = new URL(request.url);
      capturedKeys?.department?.push(...Array.from(url.searchParams.keys()));
      return HttpResponse.json({
        data: [
          {
            id: 'ou-sales',
            code: 'SALES',
            name: 'Sales',
            type: 'DEPARTMENT',
            status: 'ACTIVE',
            parentOrgUnitId: null,
            depth: 0,
            displayOrder: 1,
            createdAt: Date.now(),
          },
        ],
        meta: undefined,
      });
    }),
    http.get('*/admin/work-schedule/patterns', ({ request }) => {
      const url = new URL(request.url);
      capturedKeys?.pattern?.push(...Array.from(url.searchParams.keys()));
      return HttpResponse.json({
        data: [
          {
            workPatternId: 'pattern-active',
            patternCode: 'PATTERN_ACTIVE',
            name: 'Active operations',
            status: 'ACTIVE',
            timezone: 'Asia/Ho_Chi_Minh',
            startLocalTime: '09:00',
            endLocalTime: '18:00',
            workingMinutes: 480,
            breakMinutes: 60,
            workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
            description: null,
            externalRef: null,
            activatedAt: Date.now(),
            archivedAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        meta: undefined,
      });
    }),
    http.get('*/admin/work-schedule/holiday-calendars', ({ request }) => {
      const url = new URL(request.url);
      capturedKeys?.calendar?.push(...Array.from(url.searchParams.keys()));
      return HttpResponse.json({
        data: [
          {
            holidayCalendarId: 'holiday-calendar-active',
            calendarCode: 'VN_ACTIVE',
            name: 'Vietnam active calendar',
            scopeType: 'GLOBAL',
            timezone: 'Asia/Ho_Chi_Minh',
            status: 'ACTIVE',
            entries: [],
            description: null,
            externalRef: null,
            activatedAt: Date.now(),
            archivedAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        meta: undefined,
      });
    }),
  );
};

describe('monthly roster slice B shell surfaces', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('renders list rows and emits only backend-supported query params', async () => {
    const user = userEvent.setup();
    let capturedKeys: string[] = [];
    useRosterReferenceHandlers();
    server.use(
      http.get('*/admin/work-schedule/rosters', ({ request }) => {
        const url = new URL(request.url);
        capturedKeys = Array.from(url.searchParams.keys()).sort();
        return HttpResponse.json({ data: [baseRosterListItem()] });
      }),
    );

    renderRoute(
      '/work-schedule/rosters?status=DRAFT&rosterMonth=2026-05&departmentOrgUnitId=ou-sales&workPatternId=pattern-active&holidayCalendarId=holiday-calendar-active&search=ROSTER&sortBy=name&scope=global',
    );

    expect(await screen.findByText('ROSTER_DRAFT', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(baseRosterListItem().targetOrgUnitMode).toBe('EXACT_ONLY');
    expect(capturedKeys).toEqual([
      'departmentOrgUnitId',
      'holidayCalendarId',
      'rosterMonth',
      'scope',
      'search',
      'status',
      'workPatternId',
    ]);
    expect(
      screen.getByLabelText(i18n.t('work-schedule:monthlyRosters.filters.status')),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: (name) => name.includes(i18n.t('common:filters.moreFilters')),
      }),
    );
    expect(
      screen.getByRole('heading', { name: i18n.t('common:filters.moreFilters') }),
    ).toBeInTheDocument();
    expect(
      await within(await findPicker('monthly-roster-filter-department')).findAllByText(/SALES/),
    ).not.toHaveLength(0);
    expect(
      await within(await findPicker('monthly-roster-filter-work-pattern')).findAllByText(
        /PATTERN_ACTIVE/,
      ),
    ).not.toHaveLength(0);
    expect(
      await within(await findPicker('monthly-roster-filter-holiday-calendar')).findAllByText(
        /VN_ACTIVE/,
      ),
    ).not.toHaveLength(0);
  }, 10_000);

  it('selects and clears Monthly Roster reference filters without changing query keys', async () => {
    const user = userEvent.setup();
    useRosterReferenceHandlers();
    server.use(
      http.get('*/admin/work-schedule/rosters', () => {
        return HttpResponse.json({ data: [baseRosterListItem()] });
      }),
    );

    const router = renderRoute('/work-schedule/rosters?departmentOrgUnitId=ou-sales');

    expect(await screen.findByText('ROSTER_DRAFT', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: (name) => name.includes(i18n.t('common:filters.moreFilters')),
      }),
    );
    expect(
      await within(await findPicker('monthly-roster-filter-department')).findAllByText(/SALES/),
    ).not.toHaveLength(0);

    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'work-schedule:monthlyRosters.filters.departmentOrgUnitId',
        )}`,
      }),
    );
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).get('departmentOrgUnitId'),
      ).toBeNull();
    });

    await selectPickerOption(user, 'monthly-roster-filter-work-pattern', /PATTERN_ACTIVE/);
    await waitFor(() => {
      const query = new URLSearchParams(router.state.location.search);
      expect(query.get('workPatternId')).toBe('pattern-active');
      expect(query.get('workPatternId')).not.toBe('PATTERN_ACTIVE');
    });
    expect(screen.getAllByText(/PATTERN_ACTIVE/).length).toBeGreaterThan(0);

    await selectPickerOption(user, 'monthly-roster-filter-holiday-calendar', /VN_ACTIVE/);
    await waitFor(() => {
      const query = new URLSearchParams(router.state.location.search);
      expect(query.get('holidayCalendarId')).toBe('holiday-calendar-active');
      expect(query.get('holidayCalendarId')).not.toBe('VN_ACTIVE');
    });
  });

  it('rejects legacy EXACT roster target mode instead of treating it as a backend alias', async () => {
    server.use(
      http.get('*/admin/work-schedule/rosters', () =>
        HttpResponse.json({
          data: [
            {
              ...baseRosterListItem(),
              targetOrgUnitMode: 'EXACT',
            },
          ],
        }),
      ),
    );

    renderRoute('/work-schedule/rosters');

    expect(
      await screen.findByTestId('module-list-shell', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        i18n.t('work-schedule:monthlyRosters.states.loadErrorTitle'),
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('ROSTER_DRAFT')).not.toBeInTheDocument();
  });

  it('submits backend-shaped create draft payload with fixed timezone', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    const capturedReferenceKeys: Record<string, string[]> = {
      department: [],
      pattern: [],
      calendar: [],
    };
    useRosterReferenceHandlers(capturedReferenceKeys);
    server.use(
      http.post('*/admin/work-schedule/rosters', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: baseRosterDetail({
            monthlyRosterId: 'roster-new',
            rosterCode: 'MR-202606-000001',
          }),
        });
      }),
    );

    renderRoute('/work-schedule/rosters');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.actions.create'),
      }),
    );

    const surface = screen
      .getByRole('heading', {
        name: i18n.t('work-schedule:monthlyRosters.mutations.create.title'),
      })
      .closest('section');
    expect(surface).not.toBeNull();
    const form = within(surface as HTMLElement);
    expect(form.getByText('Asia/Ho_Chi_Minh')).toBeInTheDocument();
    expect(
      form.queryByLabelText(i18n.t('work-schedule:monthlyRosters.fields.scope')),
    ).not.toBeInTheDocument();

    await user.type(
      form.getByLabelText(i18n.t('work-schedule:monthlyRosters.fields.rosterMonth')),
      '2026-06',
    );
    await selectPickerOption(user, 'monthly-roster-department', /SALES/);
    await selectPickerOption(user, 'monthly-roster-work-pattern', /PATTERN_ACTIVE/);
    await selectPickerOption(user, 'monthly-roster-holiday-calendar', /VN_ACTIVE/);
    await user.click(
      form.getByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.mutations.create.submit'),
      }),
    );

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({
      rosterMonth: '2026-06',
      timezone: 'Asia/Ho_Chi_Minh',
      departmentOrgUnitId: 'ou-sales',
      workPatternId: 'pattern-active',
      holidayCalendarId: 'holiday-calendar-active',
      description: null,
      externalRef: null,
      scope: 'global',
    });
    expect(capturedBody).not.toHaveProperty('rosterCode');
    expect(capturedBody).not.toHaveProperty('scopeGrants');
    expect([...new Set(capturedReferenceKeys.department)].sort()).toEqual([
      'limit',
      'sortBy',
      'sortDirection',
      'status',
      'type',
    ]);
    expect([...new Set(capturedReferenceKeys.pattern)].sort()).toEqual(['limit', 'status']);
    expect([...new Set(capturedReferenceKeys.calendar)].sort()).toEqual(['limit', 'status']);
  });

  it('clears selected roster references without submitting stale IDs', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    useRosterReferenceHandlers();
    server.use(
      http.post('*/admin/work-schedule/rosters', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: baseRosterDetail() });
      }),
    );

    renderRoute('/work-schedule/rosters');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.actions.create'),
      }),
    );
    const surface = screen
      .getByRole('heading', {
        name: i18n.t('work-schedule:monthlyRosters.mutations.create.title'),
      })
      .closest('section') as HTMLElement;
    const form = within(surface);

    await user.type(
      form.getByLabelText(i18n.t('work-schedule:monthlyRosters.fields.rosterMonth')),
      rosterPlanningWindow().current,
    );
    await selectPickerOption(user, 'monthly-roster-department', /SALES/);
    await selectPickerOption(user, 'monthly-roster-work-pattern', /PATTERN_ACTIVE/);
    await selectPickerOption(user, 'monthly-roster-holiday-calendar', /VN_ACTIVE/);

    for (const fieldKey of ['departmentOrgUnitId', 'workPatternId', 'holidayCalendarId'] as const) {
      await user.click(
        form.getByRole('button', {
          name: `${i18n.t('common:actions.clear')}: ${i18n.t(
            `work-schedule:monthlyRosters.fields.${fieldKey}`,
          )}`,
        }),
      );
    }
    await user.click(
      form.getByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.mutations.create.submit'),
      }),
    );

    expect(capturedBody).toBeNull();
    expect(
      form.getAllByText(i18n.t('work-schedule:monthlyRosters.validation.required')).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it('mirrors the current plus next-two-month roster planning window', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    useRosterReferenceHandlers();
    server.use(
      http.post('*/admin/work-schedule/rosters', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: baseRosterDetail() });
      }),
    );

    renderRoute('/work-schedule/rosters');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.actions.create'),
      }),
    );
    const surface = screen
      .getByRole('heading', {
        name: i18n.t('work-schedule:monthlyRosters.mutations.create.title'),
      })
      .closest('section') as HTMLElement;
    const form = within(surface);
    const monthInput = form.getByLabelText(
      i18n.t('work-schedule:monthlyRosters.fields.rosterMonth'),
    );
    const planningWindow = rosterPlanningWindow();

    expect(monthInput).toHaveAttribute('min', planningWindow.current);
    expect(monthInput).toHaveAttribute('max', planningWindow.max);

    await user.type(monthInput, planningWindow.beyond);
    await selectPickerOption(user, 'monthly-roster-department', /SALES/);
    await selectPickerOption(user, 'monthly-roster-work-pattern', /PATTERN_ACTIVE/);
    await selectPickerOption(user, 'monthly-roster-holiday-calendar', /VN_ACTIVE/);
    await user.click(
      form.getByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.mutations.create.submit'),
      }),
    );
    expect(capturedBody).toBeNull();
    expect(monthInput).toHaveValue(planningWindow.beyond);

    await user.clear(monthInput);
    await user.type(monthInput, planningWindow.max);
    await user.click(
      form.getByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.mutations.create.submit'),
      }),
    );
    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({ rosterMonth: planningWindow.max, scope: 'global' });
  });

  it('renders denied state cleanly for monthly roster list authorization failures', async () => {
    server.use(
      http.get('*/admin/work-schedule/rosters', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'errors:permission.message' } },
          { status: 401 },
        ),
      ),
    );

    renderRoute('/work-schedule/rosters');

    expect(await screen.findByTestId('module-list-shell')).toBeInTheDocument();
    expect(
      await screen.findByText(
        (content) =>
          content === i18n.t('errors:permission.title') ||
          content === i18n.t('work-schedule:monthlyRosters.states.loadErrorTitle'),
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });

  it('renders duplicate department/month conflicts cleanly on create draft', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    useRosterReferenceHandlers();
    server.use(
      http.post('*/admin/work-schedule/rosters', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { message: 'work-schedule:monthlyRosters.validation.duplicateDepartmentMonth' },
          { status: 409 },
        );
      }),
    );

    renderRoute('/work-schedule/rosters');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.actions.create'),
      }),
    );

    const surface = screen
      .getByRole('heading', {
        name: i18n.t('work-schedule:monthlyRosters.mutations.create.title'),
      })
      .closest('section');
    expect(surface).not.toBeNull();
    const form = within(surface as HTMLElement);

    await user.type(
      form.getByLabelText(i18n.t('work-schedule:monthlyRosters.fields.rosterMonth')),
      rosterPlanningWindow().current,
    );
    await selectPickerOption(user, 'monthly-roster-department', /SALES/);
    await selectPickerOption(user, 'monthly-roster-work-pattern', /PATTERN_ACTIVE/);
    await selectPickerOption(user, 'monthly-roster-holiday-calendar', /VN_ACTIVE/);
    await user.click(
      form.getByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.mutations.create.submit'),
      }),
    );

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(
      await screen.findByText(
        i18n.t('work-schedule:monthlyRosters.validation.duplicateDepartmentMonth'),
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });

  it('renders authoritative detail, structural lock, read-only preview, publish review, update, and archive without publish calls', async () => {
    const user = userEvent.setup();
    let publishCalls = 0;
    let capturedUpdate: Record<string, unknown> | null = null;
    const archivePaths: string[] = [];
    server.use(
      http.post('*/admin/work-schedule/rosters/roster-draft/publish', () => {
        publishCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
      http.patch('*/admin/work-schedule/rosters/roster-draft', async ({ request }) => {
        capturedUpdate = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: baseRosterDetail() });
      }),
      http.post('*/admin/work-schedule/rosters/roster-draft/archive', ({ request }) => {
        archivePaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ data: baseRosterDetail({ status: 'ARCHIVED' }) });
      }),
    );

    renderRoute('/work-schedule/rosters/roster-draft');
    expect(await screen.findByText('ROSTER_DRAFT')).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('work-schedule:monthlyRosters.detail.structuralLock')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('work-schedule:monthlyRosters.exceptions.copy.previewDeferred')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('work-schedule:monthlyRosters.preview.copy.readOnly')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('work-schedule:monthlyRosters.publish.copy.reviewPreview')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.publish.actions.openConfirmation'),
      }),
    ).toBeDisabled();
    expect(
      screen.getByText(i18n.t('work-schedule:monthlyRosters.generated.states.unavailable')),
    ).toBeInTheDocument();
    expect(screen.queryByText(/approval|change request/i)).not.toBeInTheDocument();
    expect(publishCalls).toBe(0);

    await user.click(screen.getByText(i18n.t('work-schedule:monthlyRosters.actions.editDraft')));
    expect(
      screen.getByLabelText(i18n.t('work-schedule:monthlyRosters.fields.rosterMonth')),
    ).toBeDisabled();
    const externalRef = screen.getByLabelText(
      i18n.t('work-schedule:monthlyRosters.fields.externalRef'),
    );
    await user.clear(externalRef);
    await user.type(externalRef, 'MR-UPDATED');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.mutations.edit.submit'),
      }),
    );

    await waitFor(() => expect(capturedUpdate).not.toBeNull());
    expect(capturedUpdate).toEqual({
      description: 'Draft roster',
      externalRef: 'MR-UPDATED',
      scope: 'global',
    });

    await user.click(screen.getByText(i18n.t('work-schedule:monthlyRosters.actions.archive')));
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );
    await waitFor(() =>
      expect(archivePaths).toContain('/admin/work-schedule/rosters/roster-draft/archive'),
    );
    expect(publishCalls).toBe(0);
  });
});

const baseRosterListItem = () => ({
  monthlyRosterId: 'roster-draft',
  rosterCode: 'ROSTER_DRAFT',
  rosterMonth: '2026-05',
  timezone: 'Asia/Ho_Chi_Minh',
  targetSubjectKind: 'EMPLOYMENT_PROFILE',
  targetOrgUnitMode: 'EXACT_ONLY',
  departmentOrgUnitId: 'ou-sales',
  workPatternId: 'pattern-active',
  holidayCalendarId: 'holiday-calendar-active',
  status: 'DRAFT',
  draftVersion: 1,
  exceptionCount: 1,
  description: 'Draft roster',
  externalRef: 'MR-DRAFT',
  archivedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const baseRosterDetail = (overrides: Record<string, unknown> = {}) => ({
  ...baseRosterListItem(),
  previewHash: null,
  lastPreviewedAt: null,
  publishedAt: null,
  publishedByUserId: null,
  publishGenerationRunId: null,
  exceptions: [
    {
      rosterExceptionId: 'roster-exception-001',
      monthlyRosterId: 'roster-draft',
      exceptionType: 'WORKING_TO_OFF',
      exceptionDate: '2026-05-12',
      subjectEmploymentProfileId: 'ep-001',
      status: 'ACTIVE',
      title: 'Planned day off',
      startLocalTime: null,
      endLocalTime: null,
      workingMinutes: null,
      breakMinutes: null,
      studioResourceIds: [],
      reason: null,
      sourceNote: null,
      description: null,
      externalRef: null,
      removedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  ...overrides,
});
