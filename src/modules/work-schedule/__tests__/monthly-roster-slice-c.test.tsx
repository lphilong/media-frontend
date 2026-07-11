import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import {
  addRosterException,
  fetchMonthlyRosterDetail,
  removeRosterException,
  updateRosterException,
} from '@modules/work-schedule/api/work-schedule.api';
import type {
  MonthlyRosterRecord,
  RosterExceptionRecord,
} from '@modules/work-schedule/types/work-schedule.types';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { server } from '@test/msw/server';
import { renderAppWithProviders } from '@test/render-app-route';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
};

const t = (key: string): string => i18n.t(`work-schedule:monthlyRosters.exceptions.${key}`);

const openAddSurface = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    await screen.findByRole('button', {
      name: t('actions.add'),
    }),
  );

  const heading = await screen.findByRole('heading', { name: t('mutations.add.title') });
  const surface = heading.closest('section');
  expect(surface).not.toBeNull();

  return within(surface as HTMLElement);
};

const selectEmploymentProfile = async (user: ReturnType<typeof userEvent.setup>) => {
  const picker = await findPicker('monthly-roster-exception-employment-profile');
  const options = await within(picker).findAllByRole('option', {}, { timeout: 5000 });
  await user.click(options[0]);
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

describe('monthly roster slice C exception editor', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('rejects stale DAY_OFF exception values at the frontend parser seam', async () => {
    server.use(
      http.get('*/admin/work-schedule/rosters/day-off-roster', () =>
        HttpResponse.json({
          data: baseRosterDetail({
            monthlyRosterId: 'day-off-roster',
            exceptions: [
              {
                ...activeException(),
                monthlyRosterId: 'day-off-roster',
                exceptionType: 'DAY_OFF' as never,
              },
            ],
          }),
        }),
      ),
    );

    await expect(fetchMonthlyRosterDetail('day-off-roster')).rejects.toBeTruthy();
  });

  it('renders active exceptions and hides removed exceptions by default', async () => {
    const createdAt = Date.parse('2026-04-20T01:02:03.000Z');
    const updatedAt = Date.parse('2026-04-21T04:05:06.000Z');
    const removedAt = Date.parse('2026-04-22T07:08:09.000Z');
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/work-schedule/rosters/roster-draft', () =>
        HttpResponse.json({
          data: baseRosterDetail({
            exceptions: [
              activeException({ reason: 'Active schedule change', createdAt, updatedAt }),
              removedException({
                reason: 'Removed schedule change',
                createdAt,
                updatedAt,
                removedAt,
              }),
            ],
          }),
        }),
      ),
    );

    renderRoute('/work-schedule/rosters/roster-draft');

    expect(await screen.findByText('ROSTER_DRAFT', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(t('types.WORKING_TO_OFF'))).toBeInTheDocument();
    expect(screen.getByText('Active schedule change')).toBeInTheDocument();
    expect(screen.queryByText('Removed schedule change')).not.toBeInTheDocument();

    const table = screen.getByRole('table', { name: t('table.caption') });
    expect(within(table).getByText(t('table.createdAt'))).toBeInTheDocument();
    expect(within(table).getByText(t('table.updatedAt'))).toBeInTheDocument();
    expect(within(table).getByText(t('table.removedAt'))).toBeInTheDocument();
    expect(within(table).getByText('20-04-2026')).toBeInTheDocument();
    expect(within(table).getByText('11:05 21-04-2026')).toBeInTheDocument();

    await user.click(screen.getByLabelText(t('actions.showRemoved')));
    expect(screen.getByText('Removed schedule change')).toBeInTheDocument();
    expect(within(table).getByText('14:08 22-04-2026')).toBeInTheDocument();
  });

  it('allows DRAFT rosters to add WORKING_TO_OFF through a backend-shaped mutation', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    let capturedPath = '';
    server.use(
      http.post('*/admin/work-schedule/rosters/roster-draft/exceptions', async ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: baseRosterDetail({
            exceptions: [
              activeException(),
              activeException({
                rosterExceptionId: 'roster-exception-added',
                exceptionDate: '2026-05-01',
              }),
            ],
          }),
        });
      }),
    );

    renderRoute('/work-schedule/rosters/roster-draft');
    const form = await openAddSurface(user);
    await selectEmploymentProfile(user);
    await user.type(form.getByLabelText(t('fields.reason')), 'Roster day off');
    await user.click(form.getByRole('button', { name: t('mutations.add.submit') }));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedPath).toBe('/admin/work-schedule/rosters/roster-draft/exceptions');
    expect(capturedBody).toMatchObject({
      exceptionType: 'WORKING_TO_OFF',
      exceptionDate: '2026-05-01',
      subjectEmploymentProfileId: 'ep-001',
      reason: 'Roster day off',
    });
    expect(capturedBody).not.toHaveProperty('startLocalTime');
    expect(capturedBody).not.toHaveProperty('endLocalTime');
  });

  it('submits CHANGE_TIME without client-provided end time', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('*/admin/work-schedule/rosters/roster-draft/exceptions', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: baseRosterDetail() });
      }),
    );

    await addRosterException('roster-draft', {
      exceptionType: 'CHANGE_TIME',
      exceptionDate: '2026-05-13',
      subjectEmploymentProfileId: 'ep-001',
      startLocalTime: '10:30',
      reason: 'Late opening',
      scope: 'global',
    });

    expect(capturedBody).toEqual({
      exceptionType: 'CHANGE_TIME',
      exceptionDate: '2026-05-13',
      subjectEmploymentProfileId: 'ep-001',
      startLocalTime: '10:30',
      reason: 'Late opening',
      scope: 'global',
    });
    expect(capturedBody).not.toHaveProperty('endLocalTime');
  });

  it('submits ADD_SPECIAL_SHIFT with backend-supported special-shift fields', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('*/admin/work-schedule/rosters/roster-draft/exceptions', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: baseRosterDetail() });
      }),
    );

    await addRosterException('roster-draft', {
      exceptionType: 'ADD_SPECIAL_SHIFT',
      exceptionDate: '2026-05-20',
      subjectEmploymentProfileId: 'ep-001',
      title: 'Extra coverage',
      startLocalTime: '18:00',
      workingMinutes: 240,
      breakMinutes: 15,
      studioResourceIds: ['studio-001', 'studio-002'],
      description: 'Launch support',
      externalRef: 'SPECIAL-001',
      scope: 'global',
    });

    expect(capturedBody).toEqual({
      exceptionType: 'ADD_SPECIAL_SHIFT',
      exceptionDate: '2026-05-20',
      subjectEmploymentProfileId: 'ep-001',
      title: 'Extra coverage',
      startLocalTime: '18:00',
      workingMinutes: 240,
      breakMinutes: 15,
      studioResourceIds: ['studio-001', 'studio-002'],
      description: 'Launch support',
      externalRef: 'SPECIAL-001',
      scope: 'global',
    });
    expect(capturedBody).not.toHaveProperty('endLocalTime');
  });

  it('uses the studio resource picker for ADD_SPECIAL_SHIFT and submits resource IDs', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('*/admin/work-schedule/rosters/roster-draft/exceptions', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: baseRosterDetail() });
      }),
    );

    renderRoute('/work-schedule/rosters/roster-draft');
    const form = await openAddSurface(user);
    await user.selectOptions(form.getByLabelText(t('fields.type')), 'ADD_SPECIAL_SHIFT');
    await selectEmploymentProfile(user);
    await user.clear(form.getByLabelText(t('fields.exceptionDate')));
    await user.type(form.getByLabelText(t('fields.exceptionDate')), '2026-05-20');
    await user.type(form.getByLabelText(t('fields.title')), 'Extra coverage');
    await user.type(form.getByLabelText(t('fields.startLocalTime')), '18:00');
    await user.clear(form.getByLabelText(t('fields.workingMinutes')));
    await user.type(form.getByLabelText(t('fields.workingMinutes')), '240');
    await user.clear(form.getByLabelText(t('fields.breakMinutes')));
    await user.type(form.getByLabelText(t('fields.breakMinutes')), '15');
    await selectPickerOption(user, 'monthly-roster-exception-studio-resources', /SR-000001/);
    await selectPickerOption(user, 'monthly-roster-exception-studio-resources', /SR-000002/);
    await user.click(form.getByRole('button', { name: t('mutations.add.submit') }));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({
      exceptionType: 'ADD_SPECIAL_SHIFT',
      exceptionDate: '2026-05-20',
      subjectEmploymentProfileId: 'ep-001',
      title: 'Extra coverage',
      startLocalTime: '18:00',
      workingMinutes: 240,
      breakMinutes: 15,
      studioResourceIds: ['studio-001', 'studio-002'],
    });
  });

  it('updates and soft-removes exceptions through the correct mutation seams', async () => {
    let capturedUpdate: Record<string, unknown> | null = null;
    let capturedRemove: Record<string, unknown> | null = null;
    let removePath = '';
    server.use(
      http.patch(
        '*/admin/work-schedule/rosters/roster-draft/exceptions/roster-exception-001',
        async ({ request }) => {
          capturedUpdate = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ data: baseRosterDetail() });
        },
      ),
      http.post(
        '*/admin/work-schedule/rosters/roster-draft/exceptions/roster-exception-001/remove',
        async ({ request }) => {
          removePath = new URL(request.url).pathname;
          capturedRemove = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            data: baseRosterDetail({ exceptions: [removedException()] }),
          });
        },
      ),
    );

    await updateRosterException('roster-draft', 'roster-exception-001', {
      exceptionType: 'CHANGE_TIME',
      exceptionDate: '2026-05-14',
      subjectEmploymentProfileId: 'ep-001',
      startLocalTime: '11:00',
      reason: 'Updated start',
      scope: 'global',
    });
    await removeRosterException('roster-draft', 'roster-exception-001', 'global');

    expect(capturedUpdate).toEqual({
      exceptionType: 'CHANGE_TIME',
      exceptionDate: '2026-05-14',
      subjectEmploymentProfileId: 'ep-001',
      startLocalTime: '11:00',
      reason: 'Updated start',
      scope: 'global',
    });
    expect(removePath).toBe(
      '/admin/work-schedule/rosters/roster-draft/exceptions/roster-exception-001/remove',
    );
    expect(capturedRemove).toEqual({ scope: 'global' });
  });

  it('keeps MSW exception remove draft-only while preserving DRAFT remove behavior', async () => {
    await expect(fetchMonthlyRosterDetail('roster-published')).resolves.toMatchObject({
      monthlyRosterId: 'roster-published',
      status: 'PUBLISHED',
    });

    await expect(
      removeRosterException('roster-published', 'roster-exception-001', 'global'),
    ).rejects.toMatchObject({
      status: 422,
      message: 'errors:validation.invalidTransition',
    });

    const roster = await removeRosterException('roster-draft', 'roster-exception-001', 'global');

    expect(roster.status).toBe('DRAFT');
    expect(roster.draftVersion).toBe(2);
    expect(roster.exceptionCount).toBe(0);
    expect(roster.exceptions?.[0]).toMatchObject({
      rosterExceptionId: 'roster-exception-001',
      status: 'REMOVED',
    });
    expect(roster.exceptions?.[0]?.removedAt).toBeTruthy();
  });

  it('shows PUBLISHED and ARCHIVED exception sections as read-only', async () => {
    server.use(
      http.get('*/admin/work-schedule/rosters/roster-published', () =>
        HttpResponse.json({
          data: baseRosterDetail({ monthlyRosterId: 'roster-published', status: 'PUBLISHED' }),
        }),
      ),
      http.get('*/admin/work-schedule/rosters/roster-archived', () =>
        HttpResponse.json({
          data: baseRosterDetail({
            monthlyRosterId: 'roster-archived',
            status: 'ARCHIVED',
            archivedAt: Date.now(),
          }),
        }),
      ),
    );

    renderRoute('/work-schedule/rosters/roster-published');

    expect(await screen.findByText(t('copy.readOnly'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('actions.add') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('actions.edit') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('actions.remove') })).not.toBeInTheDocument();

    cleanup();
    renderRoute('/work-schedule/rosters/roster-archived');

    expect(await screen.findByText(t('copy.readOnly'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('actions.add') })).not.toBeInTheDocument();
  });

  it('blocks dates outside the roster month before submit', async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.post('*/admin/work-schedule/rosters/roster-draft/exceptions', () => {
        calls += 1;
        return HttpResponse.json({ data: baseRosterDetail() });
      }),
    );

    renderRoute('/work-schedule/rosters/roster-draft');
    const form = await openAddSurface(user);
    await selectEmploymentProfile(user);
    await user.clear(form.getByLabelText(t('fields.exceptionDate')));
    await user.type(form.getByLabelText(t('fields.exceptionDate')), '2026-06-01');
    await user.click(form.getByRole('button', { name: t('mutations.add.submit') }));

    expect(form.getByLabelText(t('fields.exceptionDate'))).toBeInvalid();
    expect(calls).toBe(0);
  });

  it('renders 403, 422, and 409 exception errors cleanly without publish or approval calls', async () => {
    const user = userEvent.setup();
    let publishCalls = 0;
    server.use(
      http.get('*/admin/work-schedule/rosters/forbidden-roster', () =>
        HttpResponse.json({ message: 'errors:permission.message' }, { status: 403 }),
      ),
      http.post('*/admin/work-schedule/rosters/roster-draft/publish', () => {
        publishCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
      http.post('*/admin/work-schedule/rosters/roster-draft/exceptions', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        if (body.reason === 'conflict') {
          return HttpResponse.json(
            { message: 'work-schedule:monthlyRosters.exceptions.validation.conflict' },
            { status: 409 },
          );
        }

        return HttpResponse.json(
          {
            message: 'work-schedule:monthlyRosters.exceptions.validation.noStandardCandidate',
            errors: {
              exceptionDate: [
                'work-schedule:monthlyRosters.exceptions.validation.noStandardCandidate',
              ],
            },
          },
          { status: 422 },
        );
      }),
    );

    await expect(fetchMonthlyRosterDetail('forbidden-roster')).rejects.toMatchObject({
      status: 403,
      permissionDenied: true,
    });

    renderRoute('/work-schedule/rosters/roster-draft');
    const form = await openAddSurface(user);
    await selectEmploymentProfile(user);
    await user.click(form.getByRole('button', { name: t('mutations.add.submit') }));
    expect(await screen.findAllByText(t('validation.noStandardCandidate'))).not.toHaveLength(0);

    await user.clear(form.getByLabelText(t('fields.reason')));
    await user.type(form.getByLabelText(t('fields.reason')), 'conflict');
    await user.click(form.getByRole('button', { name: t('mutations.add.submit') }));
    expect(await screen.findAllByText(t('validation.conflict'))).not.toHaveLength(0);

    expect(publishCalls).toBe(0);
    expect(screen.queryByText(/approval|change request/i)).not.toBeInTheDocument();
  });

  it('renders direct 401 exception add failures cleanly in the editor surface', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/admin/work-schedule/rosters/roster-draft/exceptions', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'errors:permission.message' } },
          { status: 401 },
        ),
      ),
    );

    renderRoute('/work-schedule/rosters/roster-draft');
    const form = await openAddSurface(user);
    await selectEmploymentProfile(user);
    await user.click(form.getByRole('button', { name: t('mutations.add.submit') }));

    expect(await screen.findAllByText(i18n.t('errors:permission.message'))).not.toHaveLength(0);
    expect(screen.getByRole('heading', { name: t('mutations.add.title') })).toBeInTheDocument();
  });
});

const baseRosterDetail = (overrides: Partial<MonthlyRosterRecord> = {}): MonthlyRosterRecord => ({
  monthlyRosterId: 'roster-draft',
  rosterCode: 'ROSTER_DRAFT',
  rosterMonth: '2026-05',
  timezone: 'Asia/Ho_Chi_Minh',
  targetSubjectKind: 'EMPLOYMENT_PROFILE',
  targetOrgUnitMode: 'EXACT_ONLY',
  targetType: 'ORG_UNIT',
  targetMode: 'EXACT_ONLY',
  targetOrgUnitId: 'ou-sales',
  targetTalentGroupId: null,
  departmentOrgUnitId: 'ou-sales',
  workPatternId: 'pattern-active',
  holidayCalendarId: 'holiday-calendar-active',
  status: 'DRAFT',
  draftVersion: 1,
  exceptionCount: 1,
  description: 'Draft roster',
  externalRef: 'MR-DRAFT',
  archivedAt: null,
  previewHash: null,
  lastPreviewedAt: null,
  publishedAt: null,
  publishedByUserId: null,
  publishGenerationRunId: null,
  exceptions: [activeException()],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const activeException = (
  overrides: Partial<RosterExceptionRecord> = {},
): RosterExceptionRecord => ({
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
  ...overrides,
});

const removedException = (overrides: Partial<RosterExceptionRecord> = {}): RosterExceptionRecord =>
  activeException({
    rosterExceptionId: 'roster-exception-removed',
    status: 'REMOVED',
    removedAt: Date.now(),
    title: 'Removed exception',
    ...overrides,
  });
