import i18n from 'i18next';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
  return router;
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

describe('work schedule wave 6 surfaces', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('renders Work Shift list rows, filters archived by default, and keeps scope local', async () => {
    renderRoute('/work-shifts?subjectKind=TALENT&scope=self');

    expect(
      await screen.findByRole('heading', { name: i18n.t('work-schedule:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('SHIFT002', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText('Mina')).toBeInTheDocument();
    expect(screen.queryByText('talent-001')).not.toBeInTheDocument();
    expect(screen.queryByText('Archived work shift')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('work-schedule:scopes.self'))).not.toBeInTheDocument();
    expect(
      screen.queryByText(/recurrence|attendance|bulk|delete|unarchive/i),
    ).not.toBeInTheDocument();
  });

  it('uses readable Work Shift filters while preserving internal-id query values', async () => {
    const user = userEvent.setup();
    const router = renderRoute('/work-schedule/global-ops?subjectKind=TALENT');

    expect(
      await screen.findByRole('heading', {
        name: i18n.t('work-schedule:surfaces.globalOps.title'),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Subject identifier')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Resource identifier')).not.toBeInTheDocument();
    expect(
      await screen.findByLabelText(i18n.t('work-schedule:filters.status'), {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: (name) => name.includes(i18n.t('common:filters.moreFilters')),
      }),
    );
    expect(
      screen.getByRole('heading', { name: i18n.t('common:filters.moreFilters') }),
    ).toBeInTheDocument();

    await user.click(
      await within(await findPicker('work-shift-filter-subject')).findByText(/TAL-000001/),
    );
    await waitFor(() => {
      const query = new URLSearchParams(router.state.location.search);
      expect(query.get('subjectTalentId')).toBe('talent-001');
      expect(query.get('subjectEmploymentProfileId')).toBeNull();
      expect(query.get('subjectTalentGroupId')).toBeNull();
      expect(query.get('subjectTalentId')).not.toBe('TAL-000001');
    });
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(screen.getAllByText(/TAL-000001/).length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'work-schedule:filters.subjectId',
        )}`,
      }),
    );
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('subjectTalentId')).toBeNull();
    });

    await user.click(
      await within(await findPicker('work-shift-filter-studio-resource')).findByText(/SR-000001/),
    );
    await waitFor(() => {
      const query = new URLSearchParams(router.state.location.search);
      expect(query.get('containsStudioResourceId')).toBe('studio-001');
      expect(query.get('containsStudioResourceId')).not.toBe('SR-000001');
    });

    fireEvent.change(screen.getByLabelText(i18n.t('work-schedule:filters.windowStartAt')), {
      target: { value: '2030-03-17T17:46:40' },
    });
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('windowStartAt')).toBe(
        '1900000000000',
      );
    });
    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'work-schedule:filters.windowStartAt',
        )}`,
      }),
    );
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('windowStartAt')).toBeNull();
    });
    expect(
      screen.getAllByRole('button', {
        name: i18n.t('work-schedule:actions.scheduleWorkShift'),
      }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: /admin|technical|advanced/i }),
    ).not.toBeInTheDocument();
  });

  it('renders detail from the detail API with action rail and related resource links', async () => {
    renderRoute('/work-shifts/work-shift-001?scope=team');

    expect(await screen.findByText(i18n.t('work-schedule:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('SHIFT001')).toBeInTheDocument();
    expect(screen.getByText('Main studio morning shift')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('work-schedule:scopes.team'))).toBeInTheDocument();
    expect(screen.getByText('16:00 12-05-2026')).toBeInTheDocument();
    expect(screen.getByText('19:00 12-05-2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Main Studio' })).toHaveAttribute(
      'href',
      '/studio-resources/studio-001',
    );
    expect(screen.getByRole('link', { name: 'Alice Nguyen' })).toHaveAttribute(
      'href',
      '/employment-profiles/ep-001',
    );
  });

  it('keeps archived work shifts read-only without unsupported controls', async () => {
    renderRoute('/work-shifts/work-shift-archive');

    expect(await screen.findByText(i18n.t('work-schedule:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('work-schedule:detail.archivedReadOnly'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('work-schedule:actions.edit') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('work-schedule:actions.reschedule') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('work-schedule:actions.reassignSubject') }),
    ).toBeDisabled();
    const main = screen.getByTestId('admin-shell-main');
    expect(
      within(main).queryByText(/recurrence|attendance|bulk|delete|unarchive|event/i),
    ).not.toBeInTheDocument();
  });

  it('supports create and a conservative lifecycle action from the list', async () => {
    const user = userEvent.setup();
    renderRoute('/work-shifts');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:actions.scheduleWorkShift'),
      }),
    );
    expect(
      screen.queryByRole('button', { name: /admin|technical|kỹ thuật|ky thuat/i }),
    ).not.toBeInTheDocument();

    const createHeading = await screen.findByRole('heading', {
      name: i18n.t('work-schedule:task.title'),
    });
    const createSurface = createHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const scope = within(createSurface);
    await user.type(
      scope.getByLabelText(i18n.t('work-schedule:fields.title')),
      'Wave 6 work shift',
    );
    await user.click(
      await within(await findPicker('work-shift-subject-EMPLOYMENT_PROFILE')).findByText(
        /EP-000001/,
      ),
    );
    await user.type(
      scope.getByLabelText(i18n.t('work-schedule:task.startVietnamLocal')),
      '2026-05-03T08:30',
    );
    await user.type(
      scope.getByLabelText(i18n.t('work-schedule:task.endVietnamLocal')),
      '2026-05-03T10:00',
    );
    await user.click(
      await within(await findPicker('work-shift-studio-resources')).findByText(/SR-000001/),
    );
    await user.click(
      scope.getByRole('button', { name: i18n.t('work-schedule:task.reviewAction') }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('work-schedule:task.submitAction') }),
    );

    expect(await screen.findByText('Wave 6 work shift', {}, { timeout: 3000 })).toBeInTheDocument();
    const row = screen.getByText('Wave 6 work shift').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(
      within(row).getByRole('button', { name: i18n.t('work-schedule:actions.cancel') }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('Wave 6 work shift').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }
        expect(
          within(refreshedRow).getByText(i18n.t('work-schedule:statuses.CANCELLED')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 20_000);
});
