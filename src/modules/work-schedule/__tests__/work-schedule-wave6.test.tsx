import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
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
    renderRoute('/work-shifts?subjectKind=TALENT&subjectTalentId=talent-001&scope=self');

    expect(
      await screen.findByRole('heading', { name: i18n.t('work-schedule:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('SHIFT002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText('Archived work shift')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('work-schedule:scopes.self'))).not.toBeInTheDocument();
    expect(
      screen.queryByText(/recurrence|attendance|bulk|delete|unarchive/i),
    ).not.toBeInTheDocument();
  });

  it('renders detail from the detail API with action rail and related resource links', async () => {
    renderRoute('/work-shifts/work-shift-001?scope=team');

    expect(await screen.findByText(i18n.t('work-schedule:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('SHIFT001')).toBeInTheDocument();
    expect(screen.getByText('Main studio morning shift')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('work-schedule:scopes.team'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'studio-001' })).toHaveAttribute(
      'href',
      '/studio-resources/studio-001',
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
        name: i18n.t('work-schedule:actions.adminCreateForm'),
      }),
    );

    const createHeading = await screen.findByRole('heading', {
      name: i18n.t('work-schedule:mutations.create.title'),
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
      await within(await findPicker('work-shift-admin-subject')).findByText(/EMP001/),
    );
    await user.type(
      scope.getByLabelText(i18n.t('work-schedule:fields.shiftStartAt')),
      '1900000000000',
    );
    await user.type(
      scope.getByLabelText(i18n.t('work-schedule:fields.shiftEndAt')),
      '1900003600000',
    );
    await user.click(
      await within(await findPicker('work-shift-admin-studio-resources')).findByText(/STUDIO001/),
    );
    await user.click(
      scope.getByRole('button', { name: i18n.t('work-schedule:mutations.create.submit') }),
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
