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

const textContentEquals =
  (expected: string) =>
  (_content: string, element: Element | null): boolean =>
    Boolean(element?.classList.contains('truncate') && element.textContent === expected);

describe('studio-resource wave 5 surfaces', () => {
  it('renders query-driven list rows with applied chips and bounded cursor disclosure', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/studio-resources?resourceClass=SPACE&search=Main&scope=global');

    expect(
      await screen.findByRole('heading', { name: i18n.t('studio-resource:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('SR-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Main Studio')).toBeInTheDocument();
    expect(screen.queryByText('Archived Studio')).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(
      screen.getByText(textContentEquals(`${i18n.t('common:labels.search')}: Main`)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textContentEquals(
          `${i18n.t('studio-resource:filters.resourceClass')}: ${i18n.t(
            'studio-resource:resourceClasses.SPACE',
          )}`,
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:pagination.cursorDisclosure'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('common:pagination.pageStatus'))).not.toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('common:pagination.goToPage'))).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t('common:labels.search')}`,
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByText(textContentEquals(`${i18n.t('common:labels.search')}: Main`)),
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.clearAll') }));
    expect(await screen.findByText(i18n.t('common:filters.noFiltersApplied'))).toBeInTheDocument();
  });

  it('renders availability view with the documented thinner payload', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/studio-resources?view=availability&resourceClass=SPACE');

    expect(
      await screen.findByText(i18n.t('studio-resource:availability.modeLabel')),
    ).toBeInTheDocument();
    expect(await screen.findByText('SR-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText('Room A')).not.toBeInTheDocument();
  });

  it('renders detail sections and constrained related navigation links', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/studio-resources/studio-001');

    expect(await screen.findByText(i18n.t('studio-resource:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('SR-000001')).toBeInTheDocument();
    expect(screen.getByText('Room A')).toBeInTheDocument();

    const relatedLinks = screen.getAllByRole('link', {
      name: i18n.t('studio-resource:related.openFilteredList'),
    });
    expect(
      relatedLinks.some((link) =>
        link
          .getAttribute('href')
          ?.includes('/work-shifts?view=by-resource&studioResourceId=studio-001'),
      ),
    ).toBe(true);
    expect(
      relatedLinks.some((link) =>
        link.getAttribute('href')?.includes('/events?view=by-resource&studioResourceId=studio-001'),
      ),
    ).toBe(true);
  });

  it('keeps lifecycle and availability gating aligned and archived resources read-only', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/studio-resources/studio-archive');

    expect(await screen.findByText(i18n.t('studio-resource:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('studio-resource:detail.archivedReadOnly'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('studio-resource:actions.edit') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('studio-resource:actions.outOfService') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('studio-resource:actions.restoreToActive') }),
    ).toBeDisabled();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/booking|calendar|maintenance|bulk/i)).not.toBeInTheDocument();
  });

  it('supports create and detail-first availability actions without unsupported controls', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/studio-resources');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('studio-resource:actions.create'),
      }),
    );

    const createSurfaceHeadings = await screen.findAllByRole('heading', {
      name: i18n.t('studio-resource:mutations.create.title'),
    });
    const createSurface =
      createSurfaceHeadings.map((heading) => heading.closest('section')).find(Boolean) ?? null;
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/booking|calendar|maintenance|bulk/i)).not.toBeInTheDocument();

    const createSurfaceScope = within(createSurface);
    expect(
      createSurfaceScope.queryByLabelText(i18n.t('studio-resource:fields.resourceCode')),
    ).toBeNull();
    expect(
      createSurfaceScope.getByText(i18n.t('studio-resource:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('studio-resource:fields.name')),
      'Wave 5 Studio',
    );
    await user.clear(
      createSurfaceScope.getByLabelText(i18n.t('studio-resource:fields.maxOccupancy')),
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('studio-resource:fields.maxOccupancy')),
      '8',
    );
    await user.click(
      createSurfaceScope.getByRole('button', {
        name: i18n.t('studio-resource:mutations.create.submit'),
      }),
    );

    expect(await screen.findByText('SR-000701', {}, { timeout: 3000 })).toBeInTheDocument();

    const row = screen.getByText('SR-000701').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(
      within(row).getByRole('button', { name: i18n.t('studio-resource:actions.open') }),
    );
    expect(await screen.findByText(i18n.t('studio-resource:actionRail.title'))).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: i18n.t('studio-resource:actions.outOfService') }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        expect(
          screen.getByText(i18n.t('studio-resource:statuses.OUT_OF_SERVICE')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 15_000);
});
