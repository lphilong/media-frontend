import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  getMockCurrentActorCapabilities,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import {
  setEmploymentTermsConflictNextAction,
  setEmploymentTermsRedacted,
  setEmploymentTermsStatus,
  setEmploymentTermsEmpty,
} from '@test/msw/employment-terms-handlers';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

const renderDetail = () => {
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/employment-profiles/ep-001'] });
  renderAppWithProviders(<RouterProvider router={router} />);
};

const grantTermsPermissions = (): void => {
  const base = getMockCurrentActorCapabilities();
  setMockCurrentActorCapabilities({
    ...base,
    permissions: [
      ...base.permissions,
      'employmentTerms.read',
      'employmentTerms.readSensitive',
      'employmentTerms.manageDraft',
      'employmentTerms.approve',
    ],
  });
};

const setTermsPermissions = (permissions: string[]): void => {
  const base = getMockCurrentActorCapabilities();
  setMockCurrentActorCapabilities({
    ...base,
    permissions: [
      ...base.permissions.filter((permission) => !permission.startsWith('employmentTerms.')),
      ...permissions,
    ],
  });
};

describe('employment terms admin UI', () => {
  it('renders the Employment Terms empty state', async () => {
    await setLocale(DEFAULT_LOCALE);
    grantTermsPermissions();
    setEmploymentTermsEmpty();
    renderDetail();

    expect(
      await screen.findByText(i18n.t('employment-profile:employmentTerms.empty.title'), undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();
  });

  it('renders inside EmploymentProfile detail with sensitive values returned by backend', async () => {
    await setLocale(DEFAULT_LOCALE);
    grantTermsPermissions();
    renderDetail();

    const heading = await screen.findByRole(
        'heading',
        { name: i18n.t('employment-profile:employmentTerms.title') },
        { timeout: 3000 },
      );
    expect(heading.closest('section')).toHaveAttribute('id', 'employment-terms');
    expect(await screen.findByText(/20\.000\.000/)).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('employment-profile:employmentTerms.statuses.DRAFT')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.create'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.update'),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Contract Registry/i)).not.toBeInTheDocument();
  });

  it('uses backend redaction without displaying actual salary or allowance amounts', async () => {
    await setLocale(DEFAULT_LOCALE);
    grantTermsPermissions();
    setEmploymentTermsRedacted(true);
    renderDetail();

    expect(
      await screen.findByText(i18n.t('employment-profile:employmentTerms.redacted')),
    ).toBeInTheDocument();
    expect(screen.queryByText(/20\.000\.000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/500\.000/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.update'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('employment-profile:employmentTerms.sensitivePermission')),
    ).toBeInTheDocument();
  });

  it('keeps redacted draft transitions available without constructing an update payload', async () => {
    await setLocale(DEFAULT_LOCALE);
    setTermsPermissions(['employmentTerms.read', 'employmentTerms.manageDraft']);
    setEmploymentTermsRedacted(true);
    let updateCount = 0;
    server.use(
      http.patch(
        '*/admin/employment-profiles/:employmentProfileId/employment-terms/:termsId',
        () => {
          updateCount += 1;
          return HttpResponse.json({});
        },
      ),
    );
    renderDetail();

    expect(
      await screen.findByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.submit'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.cancel'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.update'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.create'),
      }),
    ).not.toBeInTheDocument();
    expect(updateCount).toBe(0);
  });

  it('requires manage-draft and sensitive-read permissions for create and edit', async () => {
    await setLocale(DEFAULT_LOCALE);
    setTermsPermissions(['employmentTerms.read', 'employmentTerms.readSensitive']);
    renderDetail();

    await screen.findByRole('heading', {
      name: i18n.t('employment-profile:employmentTerms.title'),
    });
    expect(
      screen.queryByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.create'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.update'),
      }),
    ).not.toBeInTheDocument();
  });

  it('validates drafts and performs submit/cancel lifecycle actions', async () => {
    await setLocale(DEFAULT_LOCALE);
    grantTermsPermissions();
    const user = userEvent.setup();
    renderDetail();

    await screen.findByRole('heading', {
      name: i18n.t('employment-profile:employmentTerms.title'),
    });
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.create'),
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.save'),
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      i18n.t('employment-profile:employmentTerms.validation.required'),
    );
    await user.click(
      screen.getAllByRole('button', { name: i18n.t('common:actions.cancel') }).at(-1)!,
    );

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.submit'),
      }),
    );
    expect(
      await screen.findByText(
        i18n.t('employment-profile:employmentTerms.statuses.PENDING_APPROVAL'),
      ),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.cancel'),
      }),
    );
    expect(
      await screen.findByText(i18n.t('employment-profile:employmentTerms.statuses.CANCELLED')),
    ).toBeInTheDocument();
  });

  it('shows a safe maker-checker or overlap conflict message', async () => {
    await setLocale(DEFAULT_LOCALE);
    grantTermsPermissions();
    setEmploymentTermsConflictNextAction();
    const user = userEvent.setup();
    renderDetail();

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.submit'),
      }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('employment-profile:employmentTerms.errors.conflict')),
      ).toBeInTheDocument();
    });
  });

  it('approves pending terms through the dedicated lifecycle endpoint', async () => {
    await setLocale(DEFAULT_LOCALE);
    grantTermsPermissions();
    setEmploymentTermsStatus('terms-draft', 'PENDING_APPROVAL');
    const user = userEvent.setup();
    renderDetail();

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('employment-profile:employmentTerms.actions.approve'),
      }),
    );
    expect(
      await screen.findByText(i18n.t('employment-profile:employmentTerms.statuses.APPROVED')),
    ).toBeInTheDocument();
  });

  it('shows a discoverable no-access state and does not fetch without read permission', async () => {
    await setLocale(DEFAULT_LOCALE);
    const base = getMockCurrentActorCapabilities();
    setMockCurrentActorCapabilities({
      ...base,
      permissions: ['employmentProfile.read'],
      scopeGrants: {},
    });
    let fetchCount = 0;
    server.use(
      http.get('*/admin/employment-profiles/:employmentProfileId/employment-terms', () => {
        fetchCount += 1;
        return HttpResponse.json({ data: [] });
      }),
    );
    renderDetail();

    await screen.findByRole('heading', { name: i18n.t('employment-profile:detail.hubTitle') });
    expect(
      screen.getByRole('heading', { name: i18n.t('employment-profile:employmentTerms.title') }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('employment-profile:employmentTerms.accessRequired')),
    ).toBeInTheDocument();
    expect(fetchCount).toBe(0);
  });

  it('uses payroll-source eligibility wording in English and accented Vietnamese', async () => {
    await setLocale('vi');
    grantTermsPermissions();
    renderDetail();

    expect(await screen.findByText('Đủ điều kiện làm nguồn bảng lương')).toBeInTheDocument();
    expect(screen.queryByText('Sẵn sàng cho bảng lương')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready for payroll')).not.toBeInTheDocument();
  });
});
