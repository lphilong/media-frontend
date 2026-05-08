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
};

describe('holiday calendar slice B surfaces', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('renders list rows and emits only supported status/search params', async () => {
    let capturedKeys: string[] = [];
    server.use(
      http.get('*/admin/work-schedule/holiday-calendars', ({ request }) => {
        const url = new URL(request.url);
        capturedKeys = Array.from(url.searchParams.keys()).sort();
        return HttpResponse.json({
          data: [
            {
              holidayCalendarId: 'holiday-calendar-draft',
              calendarCode: 'VN_DRAFT',
              name: 'Vietnam draft calendar',
              scopeType: 'GLOBAL',
              timezone: 'Asia/Ho_Chi_Minh',
              status: 'DRAFT',
              entries: [],
              description: null,
              externalRef: null,
              activatedAt: null,
              archivedAt: null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        });
      }),
    );

    renderRoute('/work-schedule/holiday-calendars?status=DRAFT&search=VN&sortBy=name&scope=global');

    expect(
      await screen.findByTestId('module-list-shell', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(capturedKeys).toEqual(['search', 'status']));
  });

  it('submits create payload with fixed Global scope and fixed timezone', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('*/admin/work-schedule/holiday-calendars', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            holidayCalendarId: 'holiday-calendar-new',
            calendarCode: 'HC-000001',
            name: capturedBody.name,
            scopeType: capturedBody.scopeType,
            timezone: capturedBody.timezone,
            status: 'DRAFT',
            entries: [],
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

    renderRoute('/work-schedule/holiday-calendars');
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:holidayCalendars.actions.create'),
      }),
    );

    const surface = screen
      .getByRole('heading', {
        name: i18n.t('work-schedule:holidayCalendars.mutations.create.title'),
      })
      .closest('section');
    expect(surface).not.toBeNull();
    const form = within(surface as HTMLElement);
    expect(
      form.getByText(i18n.t('work-schedule:holidayCalendars.scopeTypes.GLOBAL')),
    ).toBeInTheDocument();
    expect(form.getByText('Asia/Ho_Chi_Minh')).toBeInTheDocument();

    await user.type(
      form.getByLabelText(i18n.t('work-schedule:holidayCalendars.fields.name')),
      'Vietnam new calendar',
    );
    await user.click(
      form.getByRole('button', {
        name: i18n.t('work-schedule:holidayCalendars.mutations.create.submit'),
      }),
    );

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({
      name: 'Vietnam new calendar',
      scopeType: 'GLOBAL',
      timezone: 'Asia/Ho_Chi_Minh',
      description: null,
      externalRef: null,
    });
    expect(capturedBody).not.toHaveProperty('calendarCode');
    expect(capturedBody).not.toHaveProperty('scopeGrants');
  });

  it('renders denied state cleanly for calendar list authorization failures', async () => {
    server.use(
      http.get('*/admin/work-schedule/holiday-calendars', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'errors:permission.message' } },
          { status: 403 },
        ),
      ),
    );

    renderRoute('/work-schedule/holiday-calendars');

    expect(await screen.findByTestId('module-list-shell')).toBeInTheDocument();
    expect(
      await screen.findByText(
        (content) =>
          content === i18n.t('errors:permission.title') ||
          content === i18n.t('work-schedule:holidayCalendars.states.loadErrorTitle'),
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });

  it('renders duplicate active-date conflicts cleanly for holiday entries', async () => {
    const user = userEvent.setup();

    renderRoute('/work-schedule/holiday-calendars/holiday-calendar-draft');
    expect(await screen.findByText('New year')).toBeInTheDocument();

    await user.click(screen.getByText(i18n.t('work-schedule:holidayCalendars.entries.add')));
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:holidayCalendars.entries.date')),
      '2026-01-01',
    );
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:holidayCalendars.entries.name')),
      'Duplicate new year',
    );
    const addSurface = screen
      .getByRole('heading', {
        name: i18n.t('work-schedule:holidayCalendars.entries.addTitle'),
      })
      .closest('section');
    expect(addSurface).not.toBeNull();
    await user.click(
      within(addSurface as HTMLElement).getByRole('button', {
        name: i18n.t('work-schedule:holidayCalendars.entries.add'),
      }),
    );

    expect(
      await screen.findByText(i18n.t('work-schedule:holidayCalendars.validation.duplicateDate')),
    ).toBeInTheDocument();
  });

  it('hides removed entries by default and sends add, update, remove, activate, and archive calls', async () => {
    const user = userEvent.setup();
    const paths: string[] = [];
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(
        '*/admin/work-schedule/holiday-calendars/:holidayCalendarId/activate',
        ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json({ data: { ...baseHolidayCalendar(), status: 'ACTIVE' } });
        },
      ),
      http.post(
        '*/admin/work-schedule/holiday-calendars/:holidayCalendarId/archive',
        ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json({ data: { ...baseHolidayCalendar(), status: 'ARCHIVED' } });
        },
      ),
      http.post(
        '*/admin/work-schedule/holiday-calendars/:holidayCalendarId/entries',
        async ({ request }) => {
          paths.push(new URL(request.url).pathname);
          bodies.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ data: baseHolidayCalendar() });
        },
      ),
      http.patch(
        '*/admin/work-schedule/holiday-calendars/:holidayCalendarId/entries/:entryId',
        async ({ request }) => {
          paths.push(new URL(request.url).pathname);
          bodies.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ data: baseHolidayCalendar() });
        },
      ),
      http.post(
        '*/admin/work-schedule/holiday-calendars/:holidayCalendarId/entries/:entryId/remove',
        ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json({ data: baseHolidayCalendar() });
        },
      ),
    );

    renderRoute('/work-schedule/holiday-calendars/holiday-calendar-draft');
    expect(await screen.findByText('New year')).toBeInTheDocument();
    expect(screen.queryByText('Removed company day')).not.toBeInTheDocument();

    await user.click(screen.getByText(i18n.t('work-schedule:holidayCalendars.entries.add')));
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:holidayCalendars.entries.date')),
      '2026-04-30',
    );
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:holidayCalendars.entries.name')),
      'Liberation day',
    );
    const addSurface = screen
      .getByRole('heading', {
        name: i18n.t('work-schedule:holidayCalendars.entries.addTitle'),
      })
      .closest('section');
    expect(addSurface).not.toBeNull();
    await user.click(
      within(addSurface as HTMLElement).getByRole('button', {
        name: i18n.t('work-schedule:holidayCalendars.entries.add'),
      }),
    );
    await waitFor(() =>
      expect(paths).toContain(
        '/admin/work-schedule/holiday-calendars/holiday-calendar-draft/entries',
      ),
    );
    expect(bodies.at(-1)).toMatchObject({
      date: '2026-04-30',
      entryType: 'HOLIDAY',
      name: 'Liberation day',
    });

    await user.click(screen.getAllByText(i18n.t('work-schedule:holidayCalendars.entries.edit'))[0]);
    const nameInput = screen.getByLabelText(i18n.t('work-schedule:holidayCalendars.entries.name'));
    await user.clear(nameInput);
    await user.type(nameInput, 'New year updated');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:holidayCalendars.entries.update'),
      }),
    );
    await waitFor(() =>
      expect(paths).toContain(
        '/admin/work-schedule/holiday-calendars/holiday-calendar-draft/entries/holiday-entry-001',
      ),
    );

    await user.click(screen.getByText(i18n.t('work-schedule:holidayCalendars.entries.remove')));
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );
    await waitFor(() =>
      expect(paths).toContain(
        '/admin/work-schedule/holiday-calendars/holiday-calendar-draft/entries/holiday-entry-001/remove',
      ),
    );

    await user.click(screen.getByText(i18n.t('work-schedule:holidayCalendars.actions.activate')));
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );
    await waitFor(() =>
      expect(paths).toContain(
        '/admin/work-schedule/holiday-calendars/holiday-calendar-draft/activate',
      ),
    );

    await user.click(screen.getByText(i18n.t('work-schedule:holidayCalendars.actions.archive')));
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );
    await waitFor(() =>
      expect(paths).toContain(
        '/admin/work-schedule/holiday-calendars/holiday-calendar-draft/archive',
      ),
    );
  });
});

const baseHolidayCalendar = () => ({
  holidayCalendarId: 'holiday-calendar-draft',
  calendarCode: 'VN_DRAFT',
  name: 'Vietnam draft calendar',
  scopeType: 'GLOBAL',
  timezone: 'Asia/Ho_Chi_Minh',
  status: 'DRAFT',
  entries: [
    {
      holidayCalendarEntryId: 'holiday-entry-001',
      date: '2026-01-01',
      entryType: 'HOLIDAY',
      name: 'New year',
      status: 'ACTIVE',
      description: null,
      externalRef: null,
      removedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  description: null,
  externalRef: null,
  activatedAt: null,
  archivedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
