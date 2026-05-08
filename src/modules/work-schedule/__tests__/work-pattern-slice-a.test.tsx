import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
};

const findCreateSurface = async () => {
  const heading = await screen.findByRole('heading', {
    name: i18n.t('work-schedule:patterns.mutations.create.title'),
  });
  const surface = heading.closest('section');
  expect(surface).not.toBeNull();
  return surface as HTMLElement;
};

const fillCreateIdentity = async (
  user: ReturnType<typeof userEvent.setup>,
  scope: ReturnType<typeof within>,
  name = 'New pattern',
) => {
  await user.type(scope.getByLabelText(i18n.t('work-schedule:patterns.fields.name')), name);
};

const replaceCreateSchedule = async (
  user: ReturnType<typeof userEvent.setup>,
  scope: ReturnType<typeof within>,
  values: {
    startLocalTime: string;
    workingMinutes: string;
    breakMinutes: string;
  },
) => {
  const startInput = scope.getByLabelText(i18n.t('work-schedule:patterns.fields.startLocalTime'));
  const workingInput = scope.getByLabelText(i18n.t('work-schedule:patterns.fields.workingMinutes'));
  const breakInput = scope.getByLabelText(i18n.t('work-schedule:patterns.fields.breakMinutes'));

  await user.clear(startInput);
  await user.type(startInput, values.startLocalTime);
  await user.clear(workingInput);
  await user.type(workingInput, values.workingMinutes);
  await user.clear(breakInput);
  await user.type(breakInput, values.breakMinutes);
};

describe('work pattern slice A surfaces', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('renders list rows with supported query state and enabled roster subnavigation', async () => {
    server.use(
      http.get('*/admin/work-schedule/patterns', () =>
        HttpResponse.json({
          data: [
            {
              workPatternId: 'pattern-draft',
              patternCode: 'PATTERN_DRAFT',
              name: 'Standard office',
              status: 'DRAFT',
              timezone: 'Asia/Ho_Chi_Minh',
              startLocalTime: '08:00',
              endLocalTime: '17:00',
              workingMinutes: 480,
              breakMinutes: 60,
              workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
              description: null,
              externalRef: null,
              activatedAt: null,
              archivedAt: null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
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
        }),
      ),
    );
    renderRoute('/work-schedule/patterns');

    expect(
      await screen.findByRole('heading', {
        name: i18n.t('work-schedule:patterns.page.title'),
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('PATTERN_DRAFT', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('PATTERN_ACTIVE', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText('PATTERN_ARCHIVED')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: i18n.t('work-schedule:rosterNav.monthlyRosters') }),
    ).toHaveAttribute('href', '/work-schedule/rosters');
    expect(
      screen.getByRole('link', { name: i18n.t('work-schedule:rosterNav.holidayCalendars') }),
    ).toHaveAttribute('href', '/work-schedule/holiday-calendars');
    expect(screen.queryByText(/preview|publish|approval|change request/i)).not.toBeInTheDocument();
  });

  it('only emits backend-supported status, search, cursor, and limit query params', async () => {
    let capturedKeys: string[] = [];
    server.use(
      http.get('*/admin/work-schedule/patterns', ({ request }) => {
        const url = new URL(request.url);
        capturedKeys = Array.from(url.searchParams.keys()).sort();
        return HttpResponse.json({
          data: [],
        });
      }),
    );

    renderRoute('/work-schedule/patterns?status=DRAFT&search=PAT&sortBy=name&scope=global');

    await screen.findByText(i18n.t('work-schedule:patterns.states.emptyTitle'));
    expect(capturedKeys).toEqual(['search', 'status']);
  });

  it('validates create fields, keeps calculated end time read-only, and submits canonical days', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('*/admin/work-schedule/patterns', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            workPatternId: 'pattern-created',
            patternCode: 'WP-000001',
            name: capturedBody.name,
            status: 'DRAFT',
            timezone: 'Asia/Ho_Chi_Minh',
            startLocalTime: capturedBody.startLocalTime,
            endLocalTime: '17:00',
            workingMinutes: capturedBody.workingMinutes,
            breakMinutes: capturedBody.breakMinutes,
            workingDays: capturedBody.workingDays,
            description: capturedBody.description,
            externalRef: capturedBody.externalRef,
            activatedAt: null,
            archivedAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }),
    );

    renderRoute('/work-schedule/patterns');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.create'),
      }),
    );

    const surface = await findCreateSurface();
    const scope = within(surface);
    expect(
      scope.queryByLabelText(i18n.t('work-schedule:patterns.fields.calculatedEndLocalTime')),
    ).not.toBeInTheDocument();
    expect(
      scope.getByText(
        i18n.t('work-schedule:patterns.form.localEstimate', {
          value: '17:00',
        }),
      ),
    ).toBeInTheDocument();

    await user.click(
      scope.getByRole('button', {
        name: i18n.t('work-schedule:patterns.mutations.create.submit'),
      }),
    );
    expect(
      await scope.findAllByText(i18n.t('work-schedule:patterns.validation.required')),
    ).not.toHaveLength(0);

    await user.type(
      scope.getByLabelText(i18n.t('work-schedule:patterns.fields.name')),
      'New pattern',
    );
    await user.click(scope.getByLabelText(i18n.t('work-schedule:patterns.weekdays.SAT')));
    await user.click(scope.getByLabelText(i18n.t('work-schedule:patterns.weekdays.SUN')));
    await user.click(
      scope.getByRole('button', {
        name: i18n.t('work-schedule:patterns.mutations.create.submit'),
      }),
    );

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({
      name: 'New pattern',
      timezone: 'Asia/Ho_Chi_Minh',
      startLocalTime: '08:00',
      workingMinutes: 480,
      breakMinutes: 60,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    });
    expect(capturedBody).not.toHaveProperty('patternCode');
    expect(capturedBody).not.toHaveProperty('endLocalTime');
  });

  it('blocks overflowing same-day schedules before submit', async () => {
    const user = userEvent.setup();
    let postCount = 0;
    server.use(
      http.post('*/admin/work-schedule/patterns', () => {
        postCount += 1;
        return HttpResponse.json({ message: 'unexpected submit' }, { status: 500 });
      }),
    );

    renderRoute('/work-schedule/patterns');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.create'),
      }),
    );

    const surface = await findCreateSurface();
    const scope = within(surface);
    await fillCreateIdentity(user, scope, 'Overflow pattern');
    await replaceCreateSchedule(user, scope, {
      startLocalTime: '20:00',
      workingMinutes: '480',
      breakMinutes: '60',
    });
    await user.click(
      scope.getByRole('button', {
        name: i18n.t('work-schedule:patterns.mutations.create.submit'),
      }),
    );

    expect(
      await scope.findByText(i18n.t('work-schedule:patterns.validation.sameDay')),
    ).toBeInTheDocument();
    expect(postCount).toBe(0);
  });

  it('submits a valid same-day schedule without changing backend-shaped payloads', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('*/admin/work-schedule/patterns', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            workPatternId: 'pattern-valid-same-day',
            patternCode: 'WP-000002',
            name: capturedBody.name,
            status: 'DRAFT',
            timezone: 'Asia/Ho_Chi_Minh',
            startLocalTime: capturedBody.startLocalTime,
            endLocalTime: '18:00',
            workingMinutes: capturedBody.workingMinutes,
            breakMinutes: capturedBody.breakMinutes,
            workingDays: capturedBody.workingDays,
            description: capturedBody.description,
            externalRef: capturedBody.externalRef,
            activatedAt: null,
            archivedAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }),
    );

    renderRoute('/work-schedule/patterns');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.create'),
      }),
    );

    const surface = await findCreateSurface();
    const scope = within(surface);
    await fillCreateIdentity(user, scope, 'Valid same day');
    await replaceCreateSchedule(user, scope, {
      startLocalTime: '09:00',
      workingMinutes: '480',
      breakMinutes: '60',
    });
    await user.click(
      scope.getByRole('button', {
        name: i18n.t('work-schedule:patterns.mutations.create.submit'),
      }),
    );

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({
      name: 'Valid same day',
      timezone: 'Asia/Ho_Chi_Minh',
      startLocalTime: '09:00',
      workingMinutes: 480,
      breakMinutes: 60,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    });
    expect(capturedBody).not.toHaveProperty('patternCode');
    expect(capturedBody).not.toHaveProperty('endLocalTime');
    expect(capturedBody).not.toHaveProperty('scopeGrants');
  });

  it('rejects exact 24:00 boundary to match backend runtime behavior', async () => {
    const user = userEvent.setup();
    let postCount = 0;
    server.use(
      http.post('*/admin/work-schedule/patterns', () => {
        postCount += 1;
        return HttpResponse.json({ message: 'unexpected submit' }, { status: 500 });
      }),
    );

    renderRoute('/work-schedule/patterns');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.create'),
      }),
    );

    const surface = await findCreateSurface();
    const scope = within(surface);
    await fillCreateIdentity(user, scope, 'Boundary pattern');
    await replaceCreateSchedule(user, scope, {
      startLocalTime: '15:00',
      workingMinutes: '480',
      breakMinutes: '60',
    });
    await user.click(
      scope.getByRole('button', {
        name: i18n.t('work-schedule:patterns.mutations.create.submit'),
      }),
    );

    expect(
      await scope.findByText(i18n.t('work-schedule:patterns.validation.sameDay')),
    ).toBeInTheDocument();
    expect(postCount).toBe(0);
  });

  it('blocks active structural edits and submits metadata-only updates', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.patch('*/admin/work-schedule/patterns/pattern-active', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            workPatternId: 'pattern-active',
            patternCode: 'PATTERN_ACTIVE',
            name: capturedBody.name,
            status: 'ACTIVE',
            timezone: 'Asia/Ho_Chi_Minh',
            startLocalTime: '09:00',
            endLocalTime: '18:00',
            workingMinutes: 480,
            breakMinutes: 60,
            workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
            description: capturedBody.description,
            externalRef: capturedBody.externalRef,
            activatedAt: Date.now(),
            archivedAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }),
    );

    renderRoute('/work-schedule/patterns/pattern-active');
    await user.click(
      await screen.findByRole('button', { name: i18n.t('work-schedule:patterns.actions.edit') }),
    );

    expect(
      screen.getByText(i18n.t('work-schedule:patterns.form.activeStructuralReadOnly')),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(i18n.t('work-schedule:patterns.fields.startLocalTime')),
    ).toBeDisabled();
    expect(screen.getByLabelText(i18n.t('work-schedule:patterns.weekdays.MON'))).toBeDisabled();

    const editSurface = screen
      .getByRole('heading', { name: i18n.t('work-schedule:patterns.mutations.edit.title') })
      .closest('section');
    expect(editSurface).not.toBeNull();
    if (!editSurface) {
      return;
    }
    const scope = within(editSurface);
    const nameInput = scope.getByLabelText(i18n.t('work-schedule:patterns.fields.name'));
    await user.clear(nameInput);
    await user.type(nameInput, 'Active metadata only');
    await user.click(
      scope.getByRole('button', { name: i18n.t('work-schedule:patterns.mutations.edit.submit') }),
    );

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toEqual({
      name: 'Active metadata only',
      description: null,
      externalRef: null,
    });
  });

  it('calls activate and archive lifecycle mutations', async () => {
    const user = userEvent.setup();
    const lifecyclePaths: string[] = [];
    server.use(
      http.post('*/admin/work-schedule/patterns/:workPatternId/activate', ({ request }) => {
        lifecyclePaths.push(new URL(request.url).pathname);
        return HttpResponse.json({
          data: {
            workPatternId: 'pattern-draft',
            patternCode: 'PATTERN_DRAFT',
            name: 'Standard office',
            status: 'ACTIVE',
            timezone: 'Asia/Ho_Chi_Minh',
            startLocalTime: '08:00',
            endLocalTime: '17:00',
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
        });
      }),
      http.post('*/admin/work-schedule/patterns/:workPatternId/archive', ({ request }) => {
        lifecyclePaths.push(new URL(request.url).pathname);
        return HttpResponse.json({
          data: {
            workPatternId: 'pattern-active',
            patternCode: 'PATTERN_ACTIVE',
            name: 'Active operations',
            status: 'ARCHIVED',
            timezone: 'Asia/Ho_Chi_Minh',
            startLocalTime: '09:00',
            endLocalTime: '18:00',
            workingMinutes: 480,
            breakMinutes: 60,
            workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
            description: null,
            externalRef: null,
            activatedAt: Date.now(),
            archivedAt: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }),
    );

    renderRoute('/work-schedule/patterns/pattern-draft');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.activate'),
      }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(() =>
      expect(lifecyclePaths).toContain('/admin/work-schedule/patterns/pattern-draft/activate'),
    );

    cleanup();
    renderRoute('/work-schedule/patterns/pattern-active');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.archive'),
      }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(() =>
      expect(lifecyclePaths).toContain('/admin/work-schedule/patterns/pattern-active/archive'),
    );
  });

  it('renders permission errors cleanly where existing utilities support them', async () => {
    server.use(
      http.get('*/admin/work-schedule/patterns', () =>
        HttpResponse.json({ message: 'errors:permission.message' }, { status: 403 }),
      ),
    );

    renderRoute('/work-schedule/patterns');
    expect(await screen.findByTestId('module-list-shell')).toBeInTheDocument();
    expect(
      await screen.findByText(
        (content) =>
          content === i18n.t('errors:permission.title') ||
          content === i18n.t('work-schedule:patterns.states.loadErrorTitle'),
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });

  it('renders 401 denied state cleanly where existing utilities support it', async () => {
    server.use(
      http.get('*/admin/work-schedule/patterns', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'errors:permission.message' } },
          { status: 401 },
        ),
      ),
    );

    renderRoute('/work-schedule/patterns');
    expect(await screen.findByTestId('module-list-shell')).toBeInTheDocument();
    expect(
      await screen.findByText(
        (content) =>
          content === i18n.t('errors:permission.title') ||
          content === i18n.t('work-schedule:patterns.states.loadErrorTitle'),
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });

  it('renders backend 422 overflow responses cleanly where existing utilities support them', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/admin/work-schedule/patterns', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'work-schedule:patterns.validation.sameDay',
            },
          },
          { status: 422 },
        ),
      ),
    );
    renderRoute('/work-schedule/patterns');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.create'),
      }),
    );
    const surface = await findCreateSurface();
    const scope = within(surface);
    await fillCreateIdentity(user, scope, 'Backend overflow');
    await replaceCreateSchedule(user, scope, {
      startLocalTime: '09:00',
      workingMinutes: '480',
      breakMinutes: '60',
    });
    await user.click(
      scope.getByRole('button', {
        name: i18n.t('work-schedule:patterns.mutations.create.submit'),
      }),
    );

    expect(
      await screen.findByText(i18n.t('work-schedule:patterns.validation.sameDay')),
    ).toBeInTheDocument();
  });

  it('renders conflict errors cleanly where existing utilities support them', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/admin/work-schedule/patterns', () =>
        HttpResponse.json({ message: 'errors:conflict.message' }, { status: 409 }),
      ),
    );
    renderRoute('/work-schedule/patterns');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.create'),
      }),
    );
    const surface = await findCreateSurface();
    const scope = within(surface);
    await user.type(
      scope.getByLabelText(i18n.t('work-schedule:patterns.fields.name')),
      'Duplicate pattern',
    );
    await user.click(
      scope.getByRole('button', {
        name: i18n.t('work-schedule:patterns.mutations.create.submit'),
      }),
    );

    expect(await screen.findByText(i18n.t('errors:conflict.message'))).toBeInTheDocument();
  });
});
