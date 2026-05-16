import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import {
  OrgUnitCreateSurface,
  OrgUnitMoveSurface,
} from '@modules/org-unit/forms/org-unit-mutation-forms';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

vi.mock('@shared/components/reference/admin-reference-options', () => ({
  loadOrgUnitReferenceOptions: vi.fn(async () => [
    {
      id: 'ou-parent',
      label: 'Parent Unit - OU-PARENT',
      description: 'ACTIVE',
      href: '/org-units/ou-parent',
    },
    {
      id: 'ou-new-parent',
      label: 'New Parent - OU-NEW',
      description: 'ACTIVE',
      href: '/org-units/ou-new-parent',
    },
  ]),
}));

const renderRoute = (path: string) => {
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

  renderAppWithProviders(<RouterProvider router={router} />, { queryClient });
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

describe('org unit wave 3 surfaces', () => {
  it('renders list rows for query-driven Org Unit routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/org-units?status=INACTIVE&search=OU-000003');

    expect(
      await screen.findByRole('heading', { name: i18n.t('org-unit:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('OU-000003', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('Operations', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders detail hierarchy and detail-first action surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/org-units/ou-root');

    expect(await screen.findByText(i18n.t('org-unit:actionRail.title'))).toBeInTheDocument();

    const activateButton = screen.getByRole('button', {
      name: i18n.t('org-unit:actions.activate'),
    });
    const deactivateButton = screen.getByRole('button', {
      name: i18n.t('org-unit:actions.deactivate'),
    });
    expect(activateButton).toBeDisabled();
    expect(deactivateButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: i18n.t('org-unit:actions.move') }));
    expect(await screen.findByText(i18n.t('org-unit:mutations.move.title'))).toBeInTheDocument();
    expect(await findPicker('org-unit-new-parent')).toBeInTheDocument();
  });

  it('submits selected parent org unit references from create and move surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onMove = vi.fn();

    const createRender = renderAppWithProviders(
      <MemoryRouter>
        <OrgUnitCreateSurface onCancel={() => undefined} onSubmit={onCreate} />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText(i18n.t('org-unit:fields.code'))).toBeNull();
    expect(screen.getByText(i18n.t('org-unit:generatedCode.description'))).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('org-unit:fields.name')), 'Selector Unit');
    await user.type(screen.getByLabelText(i18n.t('org-unit:fields.type')), 'TEAM');
    await user.type(screen.getByLabelText(i18n.t('org-unit:fields.externalRef')), 'EXT-OU');
    await selectPickerOption(user, 'org-unit-parent', /OU-PARENT/);
    await user.click(
      screen.getByRole('button', { name: i18n.t('org-unit:mutations.create.submit') }),
    );
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        parentOrgUnitId: 'ou-parent',
        externalRef: 'EXT-OU',
      }),
    );
    expect(onCreate.mock.calls[0][0]).not.toHaveProperty('code');
    createRender.unmount();

    renderAppWithProviders(
      <MemoryRouter>
        <OrgUnitMoveSurface
          currentOrgUnitId="ou-current"
          currentParentOrgUnitId={null}
          onCancel={() => undefined}
          onSubmit={onMove}
        />
      </MemoryRouter>,
    );
    await selectPickerOption(user, 'org-unit-new-parent', /OU-NEW/);
    await user.click(
      screen.getByRole('button', { name: i18n.t('org-unit:mutations.move.submit') }),
    );
    expect(onMove).toHaveBeenCalledWith({
      newParentOrgUnitId: 'ou-new-parent',
    });
  });

  it('supports create and lifecycle mutation flows from list/detail surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/org-units');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('org-unit:actions.create'),
      }),
    );

    const createSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('org-unit:mutations.create.title'),
    });
    const createSurface = createSurfaceHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const createSurfaceScope = within(createSurface);
    expect(createSurfaceScope.queryByLabelText(i18n.t('org-unit:fields.code'))).toBeNull();
    expect(
      createSurfaceScope.getByText(i18n.t('org-unit:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('org-unit:fields.name')),
      'Wave 3 Org',
    );
    await user.type(createSurfaceScope.getByLabelText(i18n.t('org-unit:fields.type')), 'TEAM');
    const displayOrderInput = createSurfaceScope.getByLabelText(
      i18n.t('org-unit:fields.displayOrder'),
    );
    await user.clear(displayOrderInput);
    await user.type(displayOrderInput, '17');
    await user.click(
      createSurfaceScope.getByRole('button', { name: i18n.t('org-unit:mutations.create.submit') }),
    );

    expect(await screen.findByText('OU-000101', {}, { timeout: 3000 })).toBeInTheDocument();

    const row = screen.getByText('OU-000101').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(
      within(row).getByRole('button', { name: i18n.t('org-unit:actions.deactivate') }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('OU-000101').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }

        expect(within(refreshedRow).getByText(/inactive/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('keeps Org Unit create and query controls inspectable when the list request fails', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/org-units', () =>
        HttpResponse.json({ message: 'errors:transport.generic' }, { status: 500 }),
      ),
    );

    renderRoute('/org-units?status=INACTIVE&search=OU-000003');

    expect(await screen.findByText(i18n.t('org-unit:states.loadErrorTitle'))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.t('org-unit:filters.searchPlaceholder'))).toHaveValue(
      'OU-000003',
    );
    expect(screen.getByRole('combobox', { name: i18n.t('org-unit:filters.status') })).toHaveValue(
      'INACTIVE',
    );

    await user.click(screen.getByRole('button', { name: i18n.t('org-unit:actions.create') }));

    expect(
      await screen.findByRole('heading', { name: i18n.t('org-unit:mutations.create.title') }),
    ).toBeInTheDocument();
  });
});
