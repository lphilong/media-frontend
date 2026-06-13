import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import {
  deliverContractObligation,
  linkContractObligationEventEvidence,
  rejectContractObligation,
  removeContractObligationEventEvidence,
} from '@modules/contract-registry/api/contract-registry.api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  getMockCurrentActorCapabilities,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import { renderAppWithProviders } from '@test/render-app-route';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
};

describe('contract registry wave 7 surfaces', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('renders Contract Registry list rows, filters archived by default, and keeps scope absent', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records?scope=global&scopeGrants=x');

    expect(
      await screen.findByRole('heading', { name: i18n.t('contract-registry:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CON-2026-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('contract-registry:boundaries.LEGACY_EMPLOYMENT_DEPRECATED.label'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(i18n.t('contract-registry:boundaries.COMMERCIAL_LEGAL_SUPPORTED.label'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(i18n.t('contract-registry:boundaries.UNSUPPORTED_CONTRACT_KIND.label'))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Alice Nguyen').length).toBeGreaterThan(0);
    expect(screen.queryByText('ep-001')).not.toBeInTheDocument();
    const activeRow = screen.getByText('CON-2026-000002').closest('tr');
    expect(activeRow).not.toBeNull();
    if (!activeRow) {
      return;
    }
    expect(
      within(activeRow).getByRole('button', { name: i18n.t('contract-registry:actions.expire') }),
    ).toBeInTheDocument();
    expect(
      within(activeRow).getByRole('button', {
        name: i18n.t('contract-registry:actions.terminate'),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Archived contract record')).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.noFiltersApplied'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expect(
      screen.getByRole('combobox', { name: i18n.t('contract-registry:filters.contractKind') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', {
        name: i18n.t('contract-registry:contractKinds.EMPLOYMENT'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/scope|scopeGrants|delete|bulk|unarchive|upload|download/i),
    ).not.toBeInTheDocument();
  });

  it('renders Contract Registry applied chips and clears exact flat filter keys', async () => {
    const user = userEvent.setup();
    renderRoute(
      '/contract-records?search=CON-2026-000001&hasFileReference=true&effectiveEndDateFrom=2026-05-19&effectiveEndDateTo=2026-06-18',
    );

    expect(await screen.findByText('CON-2026-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(screen.getByText('Effective end date from:')).toBeInTheDocument();
    expect(screen.getByText('Effective end date to:')).toBeInTheDocument();
    expect(screen.getByText(/2026-05-19/)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-18/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expect(
      screen.getByRole('combobox', {
        name: i18n.t('contract-registry:filters.hasFileReference'),
      }),
    ).toHaveValue('true');
    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'contract-registry:filters.hasFileReference',
        )}`,
      }),
    );
    expect(
      screen.getByRole('combobox', {
        name: i18n.t('contract-registry:filters.hasFileReference'),
      }),
    ).toHaveValue('');
  });

  it('renders detail from detail API with links, action rail, and file metadata only', async () => {
    renderRoute('/contract-records/contract-record-001');

    expect(
      await screen.findByText(i18n.t('contract-registry:actionRail.title')),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('contract-registry:detail.boundaryHelper'))).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('contract-registry:boundaries.LEGACY_EMPLOYMENT_DEPRECATED.label'))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('CON-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('alice-contract.pdf')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Alice Nguyen' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Alice Nguyen' })[0]).toHaveAttribute(
      'href',
      '/employment-profiles/ep-001',
    );
    expect(screen.queryByText('ep-001')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: i18n.t('contract-registry:related.commissionRules') }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('contract-registry:actions.markPendingSignature'),
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('contract-registry:actions.activate') }),
    ).toBeDisabled();
    expect(
      screen.queryByText(/approval|signing workflow|file vault|upload|download|payroll|payout/i),
    ).not.toBeInTheDocument();
  });

  it('renders CR-3C obligation and historical Event evidence review on supported contracts', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records/contract-record-active');

    expect(
      await screen.findByRole('heading', {
        name: i18n.t('contract-registry:obligations.sectionTitle'),
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('OBL-2026-000002')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.create'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('contract-registry:obligations.types.SERVICE_MILESTONE')),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('contract-registry:obligations.evidencePolicies.REQUIRED')).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /OBL-2026-000002/ }));

    expect(
      await screen.findByText(i18n.t('contract-registry:obligations.helpers.snapshot')),
    ).toBeInTheDocument();
    expect(screen.getByText('EVT-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('EVT-2026-000099')).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('contract-registry:obligations.linkStatuses.ACTIVE')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(i18n.t('contract-registry:obligations.linkStatuses.REMOVED')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('SERVICE_MILESTONE')).not.toBeInTheDocument();
    expect(screen.queryByText('REMOVED')).not.toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) =>
        Boolean(
          element?.tagName === 'SPAN' &&
          element.textContent?.includes(
            i18n.t('contract-registry:obligations.eventStatuses.COMPLETED'),
          ),
        ),
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/https:\/\/example\.test\/event-evidence/).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText(i18n.t('contract-registry:obligations.historyTitle')),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('contract-registry:obligations.values.displayUnavailable')).length,
    ).toBeGreaterThan(0);
  });

  it('renders source-backed obligation list context and state-driven row actions', async () => {
    renderRoute('/contract-records/contract-record-active');

    const deliveredRow = (await screen.findByText('OBL-2026-000003')).closest('tr');
    expect(deliveredRow).not.toBeNull();
    if (!deliveredRow) {
      return;
    }
    expect(within(deliveredRow).getByText('Bao Tran')).toBeInTheDocument();
    expect(
      within(deliveredRow).getAllByText((_, element) =>
        Boolean(
          element?.textContent?.includes(
            i18n.t('contract-registry:obligations.fields.deliveredAt'),
          ),
        ),
      ).length,
    ).toBeGreaterThan(0);
    expect(deliveredRow).toHaveTextContent(
      i18n.t('contract-registry:obligations.values.displayUnavailable'),
    );
    expect(
      within(deliveredRow).getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.detail'),
      }),
    ).toBeInTheDocument();
    expect(
      within(deliveredRow).getByText(i18n.t('contract-registry:obligations.actions.accept')),
    ).toBeInTheDocument();
    expect(
      within(deliveredRow).getByText(i18n.t('contract-registry:obligations.actions.reject')),
    ).toBeInTheDocument();
    expect(within(deliveredRow).queryByText('DELIVERED')).not.toBeInTheDocument();
    expect(within(deliveredRow).queryByText('REPORTING')).not.toBeInTheDocument();

    const rejectedRow = screen
      .getAllByText('OBL-2026-000004')
      .map((element) => element.closest('tr'))
      .find((element): element is HTMLTableRowElement => Boolean(element));
    expect(rejectedRow).not.toBeNull();
    if (!rejectedRow) {
      return;
    }
    expect(
      within(rejectedRow).getByText(
        i18n.t('contract-registry:obligations.values.displayUnavailable'),
      ),
    ).toBeInTheDocument();
    expect(rejectedRow).toHaveTextContent('employme...0004');
    expect(rejectedRow).not.toHaveTextContent('employment-profile-without-display-000004');
    expect(rejectedRow).toHaveTextContent('Evidence reference was incomplete.');
    expect(
      within(rejectedRow).getByText(i18n.t('contract-registry:obligations.actions.reopen')),
    ).toBeInTheDocument();
  });

  it('renders Event evidence action-history actor display without using raw actor IDs as names', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records/contract-record-active');

    await user.click(await screen.findByRole('button', { name: /OBL-2026-000002/ }));
    const removedLinkRow = (await screen.findByText('EVT-2026-000099')).closest('tr');
    expect(removedLinkRow).not.toBeNull();
    if (!removedLinkRow) {
      return;
    }

    expect(
      within(removedLinkRow).getByText(i18n.t('contract-registry:obligations.linkActions.LINKED')),
    ).toBeInTheDocument();
    expect(
      within(removedLinkRow).getAllByText(
        i18n.t('contract-registry:obligations.linkActions.REMOVED'),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      within(removedLinkRow).getAllByText('Liên kết ban đầu để kiểm tra lịch sử.').length,
    ).toBeGreaterThan(0);
    expect(
      within(removedLinkRow).getAllByText('Không còn phù hợp với nghĩa vụ này.').length,
    ).toBeGreaterThan(0);
    expect(removedLinkRow).toHaveTextContent('admin-us...0001');
    expect(removedLinkRow).toHaveTextContent(
      i18n.t('contract-registry:obligations.values.displayUnavailable'),
    );
    expect(within(removedLinkRow).getAllByText(/07:00 21-04-2026/).length).toBeGreaterThan(0);
    expect(within(removedLinkRow).queryByText('admin-user-actor-000001')).not.toBeInTheDocument();
  });

  it('reopens a rejected obligation with an explicit bounded reason', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records/contract-record-active');

    await user.click(await screen.findByRole('button', { name: /OBL-2026-000004/ }));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.reopen'),
      }),
    );
    const surface = screen
      .getByRole('heading', {
        name: i18n.t('contract-registry:obligations.forms.reopenTitle'),
      })
      .closest('section');
    expect(surface).not.toBeNull();
    if (!surface) {
      return;
    }
    expect(
      within(surface).getByText(i18n.t('contract-registry:obligations.helpers.reopen')),
    ).toBeInTheDocument();
    await user.type(
      within(surface).getByLabelText(i18n.t('contract-registry:obligations.fields.reason')),
      'Correct the rejected evidence package',
    );
    await user.click(
      within(surface).getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.reopen'),
      }),
    );

    await waitFor(() => {
      expect(
        screen.getAllByText(i18n.t('contract-registry:obligations.statuses.OPEN')).length,
      ).toBeGreaterThan(0);
    });
  }, 20_000);

  it('selects a completed Event search result instead of requiring raw Event ID input', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records/contract-record-active');

    await user.click(await screen.findByRole('button', { name: /OBL-2026-000002/ }));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.linkEvent'),
      }),
    );
    const surface = screen
      .getAllByRole('heading', {
        name: i18n.t('contract-registry:obligations.forms.linkEventTitle'),
      })
      .find((heading) => heading.closest('[data-mutation-kind]'))
      ?.closest('section');
    expect(surface).not.toBeNull();
    if (!surface) {
      return;
    }
    expect(
      within(surface).queryByRole('textbox', {
        name: i18n.t('contract-registry:obligations.fields.eventId'),
      }),
    ).not.toBeInTheDocument();
    await user.click(await within(surface).findByRole('button', { name: /Completed event/ }));
    await user.type(
      within(surface).getByLabelText(i18n.t('contract-registry:obligations.fields.linkReason')),
      'Explicitly selected completion evidence',
    );
    await user.click(
      within(surface).getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.linkEvent'),
      }),
    );
    expect(await screen.findByText('EVT-2026-000777')).toBeInTheDocument();
  }, 20_000);

  it('enforces strict backend-aligned mutation payload bounds before requests are sent', async () => {
    const overReason = 'x'.repeat(1_001);
    await expect(
      linkContractObligationEventEvidence('obligation-open-required', {
        eventId: 'event-completed',
        linkReason: overReason,
      }),
    ).rejects.toMatchObject({ name: 'ZodError' });
    await expect(
      removeContractObligationEventEvidence('event-evidence-link-active-001', {
        removeReason: overReason,
      }),
    ).rejects.toMatchObject({ name: 'ZodError' });
    await expect(
      deliverContractObligation('obligation-open-required', {
        deliveryNote: 'x'.repeat(2_001),
        evidenceRefs: [],
        eventEvidenceLinkIds: ['event-evidence-link-active-001'],
      }),
    ).rejects.toMatchObject({ name: 'ZodError' });
    await expect(
      rejectContractObligation('obligation-delivered-001', { reason: overReason }),
    ).rejects.toMatchObject({ name: 'ZodError' });
  });

  it('uses dedicated Event evidence read permission and keeps read-only actors mutation-free', async () => {
    const capabilities = getMockCurrentActorCapabilities();
    setMockCurrentActorCapabilities({
      ...capabilities,
      roles: ['viewer-auditor'],
      permissions: [
        'contractRegistry.read',
        'contractObligation.read',
        'contractObligation.eventEvidenceLink.read',
      ],
    });
    renderRoute('/contract-records/contract-record-active');

    await screen.findByText('OBL-2026-000002');
    await userEvent.click(screen.getByRole('button', { name: /OBL-2026-000002/ }));
    expect(await screen.findByText('EVT-2026-000001')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.linkEvent'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.removeLink'),
      }),
    ).not.toBeInTheDocument();
  });

  it('shows a restricted state when dedicated Event evidence read permission is absent', async () => {
    const capabilities = getMockCurrentActorCapabilities();
    setMockCurrentActorCapabilities({
      ...capabilities,
      permissions: capabilities.permissions.filter(
        (permission) => permission !== 'contractObligation.eventEvidenceLink.read',
      ),
    });
    renderRoute('/contract-records/contract-record-active');

    await screen.findByText('OBL-2026-000002');
    expect(
      screen.getByText(i18n.t('contract-registry:obligations.eventEvidenceReadRestricted')),
    ).toBeInTheDocument();
    expect(screen.queryByText('EVT-2026-000001')).not.toBeInTheDocument();
  });

  it('keeps CR-3C unavailable and action-free for legacy contracts', async () => {
    renderRoute('/contract-records/contract-record-001');

    expect(
      await screen.findByText(i18n.t('contract-registry:obligations.unavailable')),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.create'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.linkEvent'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.deliver'),
      }),
    ).not.toBeInTheDocument();
  });

  it('requires explicit reasons for Event evidence link and remove actions', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records/contract-record-active');

    await screen.findByText('OBL-2026-000002');
    await user.click(screen.getByRole('button', { name: /OBL-2026-000002/ }));
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.linkEvent'),
      }),
    );
    const linkForm = screen
      .getAllByRole('heading', {
        name: i18n.t('contract-registry:obligations.forms.linkEventTitle'),
      })
      .find((heading) => heading.closest('[data-mutation-kind]'))
      ?.closest('section');
    expect(linkForm).not.toBeNull();
    if (!linkForm) {
      return;
    }
    await user.click(await within(linkForm).findByRole('button', { name: /Completed event/ }));
    await user.click(
      within(linkForm).getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.linkEvent'),
      }),
    );
    expect(screen.getByText(i18n.t('contract-registry:validation.required'))).toBeInTheDocument();

    await user.click(
      within(linkForm).getByRole('button', { name: i18n.t('common:actions.cancel') }),
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.removeLink'),
      }),
    );
    const removeForm = screen
      .getByRole('heading', {
        name: i18n.t('contract-registry:obligations.forms.remove-linkTitle'),
      })
      .closest('section');
    expect(removeForm).not.toBeNull();
    if (!removeForm) {
      return;
    }
    await user.click(
      within(removeForm).getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.remove-link'),
      }),
    );
    expect(screen.getByText(i18n.t('contract-registry:validation.required'))).toBeInTheDocument();
  }, 20_000);

  it('requires delivery evidence and disables removed Event evidence links', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records/contract-record-active');

    await screen.findByText('OBL-2026-000002');
    await user.click(screen.getByRole('button', { name: /OBL-2026-000002/ }));
    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.deliver'),
      }),
    );
    const deliverForm = screen
      .getByRole('heading', {
        name: i18n.t('contract-registry:obligations.forms.deliverTitle'),
      })
      .closest('section');
    expect(deliverForm).not.toBeNull();
    if (!deliverForm) {
      return;
    }

    expect(
      within(deliverForm).getByText(i18n.t('contract-registry:obligations.helpers.delivery')),
    ).toBeInTheDocument();
    expect(within(deliverForm).getByRole('checkbox', { name: /EVT-2026-000001/ })).toBeEnabled();
    expect(within(deliverForm).getByRole('checkbox', { name: /EVT-2026-000099/ })).toBeDisabled();

    await user.click(
      within(deliverForm).getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.deliver'),
      }),
    );
    expect(
      screen.getByText(i18n.t('contract-registry:obligations.validation.requiredEvidence')),
    ).toBeInTheDocument();
  }, 20_000);

  it('keeps accept and reject as explicit review actions with no money or file side effect', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records/contract-record-active');

    await screen.findByText('OBL-2026-000003');
    await user.click(screen.getByRole('button', { name: /OBL-2026-000003/ }));
    expect(
      await screen.findByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.accept'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.reject'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('contract-registry:obligations.helpers.acceptance')),
    ).toBeInTheDocument();
    expect(screen.getByText('EVT-2026-000055')).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('contract-registry:obligations.values.selectedForDelivery')),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('contract-registry:obligations.actions.accept'),
      }),
    );
    const acceptForm = screen
      .getByRole('heading', {
        name: i18n.t('contract-registry:obligations.forms.acceptTitle'),
      })
      .closest('section');
    expect(acceptForm).not.toBeNull();
    if (!acceptForm) {
      return;
    }
    expect(
      within(acceptForm).getByText(i18n.t('contract-registry:obligations.helpers.review')),
    ).toBeInTheDocument();
  }, 20_000);

  it('keeps archived contract records read-only without unsupported controls', async () => {
    renderRoute('/contract-records/contract-record-archived');

    expect(
      await screen.findByText(i18n.t('contract-registry:actionRail.title')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('contract-registry:detail.archivedReadOnly')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('contract-registry:actions.editDraftCore') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('contract-registry:actions.assignOwner') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('contract-registry:actions.updateFileReference') }),
    ).toBeDisabled();
    const main = screen.getByTestId('admin-shell-main');
    expect(
      within(main).queryByText(/delete|bulk|unarchive|approval|signing|vault|upload|download/i),
    ).not.toBeInTheDocument();
  });

  it('supports create and a conservative lifecycle action from the list', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('contract-registry:actions.create'),
      }),
    );

    const createHeading = await screen.findByRole('heading', {
      name: i18n.t('contract-registry:mutations.create.title'),
    });
    const createSurface = createHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const scope = within(createSurface);
    expect(scope.queryByLabelText(i18n.t('contract-registry:fields.contractCode'))).toBeNull();
    expect(
      scope.getByText(i18n.t('contract-registry:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(
      scope.getByLabelText(i18n.t('contract-registry:fields.title')),
      'Wave 7 contract',
    );
    const contractKind = scope.getByLabelText(i18n.t('contract-registry:fields.contractKind'));
    expect(contractKind).toHaveValue('TALENT_SERVICE');
    expect(
      within(contractKind).queryByRole('option', {
        name: i18n.t('contract-registry:contractKinds.EMPLOYMENT'),
      }),
    ).not.toBeInTheDocument();
    await user.click(await scope.findByRole('button', { name: /Mina/ }));
    await user.click(await scope.findByRole('button', { name: /Alice/ }));
    await user.type(
      scope.getByLabelText(i18n.t('contract-registry:fields.effectiveStartDate')),
      '2026-01-01',
    );
    await user.click(
      scope.getByRole('button', { name: i18n.t('contract-registry:mutations.create.submit') }),
    );

    expect(await screen.findByText('CON-2026-000101', {}, { timeout: 3000 })).toBeInTheDocument();
    const row = screen.getByText('CON-2026-000101').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(
      within(row).getByRole('button', {
        name: i18n.t('contract-registry:actions.mark-pending-signature'),
      }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('CON-2026-000101').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }
        expect(
          within(refreshedRow).getByText(i18n.t('contract-registry:statuses.PENDING_SIGNATURE')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 20_000);

  it('supports date-based expire action from an eligible list row', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records');

    expect(await screen.findByText('CON-2026-000002', {}, { timeout: 3000 })).toBeInTheDocument();
    const activeRow = screen.getByText('CON-2026-000002').closest('tr');
    expect(activeRow).not.toBeNull();
    if (!activeRow) {
      return;
    }

    await user.click(
      within(activeRow).getByRole('button', { name: i18n.t('contract-registry:actions.expire') }),
    );
    const expireSurface = await screen.findByRole('heading', {
      name: i18n.t('contract-registry:mutations.expire.title'),
    });
    const section = expireSurface.closest('section');
    expect(section).not.toBeNull();
    if (!section) {
      return;
    }

    await user.type(
      within(section).getByLabelText(i18n.t('contract-registry:fields.expiryDate')),
      '2026-05-01',
    );
    await user.click(
      within(section).getByRole('button', {
        name: i18n.t('contract-registry:mutations.expire.submit'),
      }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('CON-2026-000002').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }
        expect(
          within(refreshedRow).getByText(i18n.t('contract-registry:statuses.EXPIRED')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 20_000);
});
