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

describe('talent wave 4 surfaces', () => {
  it('renders filtered list rows for query-driven Talent routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talents?operationalStatus=SUSPENDED&search=Bao&hasLinkedEmploymentProfile=false');

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('TAL002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('BaoStar', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders detail sections and constrained related navigation links', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talents/talent-001');

    expect(await screen.findByText(i18n.t('talent:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('TAL001')).toBeInTheDocument();

    const relatedLinks = screen.getAllByRole('link', {
      name: i18n.t('talent:related.openFilteredList'),
    });
    expect(relatedLinks.length).toBeGreaterThan(0);
    expect(
      relatedLinks.some((link) =>
        link.getAttribute('href')?.includes('/talent-groups?view=by-talent&talentId=talent-001'),
      ),
    ).toBe(true);
  });

  it('keeps lifecycle/action gating aligned and opens detail-first mutation surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/talents/talent-003');

    expect(await screen.findByText(i18n.t('talent:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('talent:actions.suspend') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('talent:actions.reactivate') })).toBeEnabled();
    expect(screen.getByRole('button', { name: i18n.t('talent:actions.archive') })).toBeEnabled();

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent:actions.updateCommercialParticipation'),
      }),
    );
    expect(
      await screen.findByRole('heading', {
        name: i18n.t('talent:mutations.commercialParticipation.title'),
      }),
    ).toBeInTheDocument();
  });

  it('supports create and lifecycle transitions from list/detail surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/talents');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('talent:actions.create'),
      }),
    );

    const createSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('talent:mutations.create.title'),
    });
    const createSurface = createSurfaceHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const createSurfaceScope = within(createSurface);
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('talent:fields.talentCode')),
      'WAVE4TAL',
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('talent:fields.stageName')),
      'Wave 4 Talent',
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('talent:fields.legalName')),
      'Wave Four Talent',
    );
    await user.selectOptions(
      createSurfaceScope.getByLabelText(i18n.t('talent:fields.talentOrigin')),
      'INTERNAL',
    );
    await user.click(
      createSurfaceScope.getByRole('button', {
        name: i18n.t('talent:mutations.create.submit'),
      }),
    );

    expect(await screen.findByText('WAVE4TAL', {}, { timeout: 3000 })).toBeInTheDocument();

    const row = screen.getByText('WAVE4TAL').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(
      within(row).getByRole('button', { name: i18n.t('talent:actions.deactivate') }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('WAVE4TAL').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }
        expect(
          within(refreshedRow).getByText(i18n.t('talent:statuses.INACTIVE')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 15_000);
});
