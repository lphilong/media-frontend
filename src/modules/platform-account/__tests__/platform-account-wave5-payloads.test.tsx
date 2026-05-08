import i18n from 'i18next';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  PlatformAccountCapabilitiesSurface,
  PlatformAccountCreateSurface,
  PlatformAccountEditSurface,
  PlatformAccountOwnershipTransferSurface,
} from '@modules/platform-account/forms/platform-account-mutation-forms';
import {
  performPlatformAccountLifecycleAction,
  updatePlatformAccountCapabilities,
} from '@modules/platform-account/api/platform-account.api';
import { apiRequest } from '@shared/api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  parseScreenQueryParams,
  platformAccountFlatListQueryConfig,
  serializeScreenQueryParams,
} from '@shared/query';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

const renderWithProviders = (ui: JSX.Element) => render(ui);

describe('platform-account wave 5 query and payload seams', () => {
  const mockedApiRequest = vi.mocked(apiRequest);

  afterEach(() => {
    mockedApiRequest.mockReset();
  });

  it('parses/builds only supported query keys and normalizes owner filters safely', () => {
    const parsed = parseScreenQueryParams(
      new URLSearchParams(
        'ownerKind=TALENT&ownerOrgUnitId=ou-1&ownerTalentId=talent-1&scope=global&sortBy=handle',
      ),
      platformAccountFlatListQueryConfig,
    );
    expect(parsed).toEqual({});

    const inferred = serializeScreenQueryParams(
      {
        ownerKind: 'TALENT',
        ownerOrgUnitId: 'ou-1',
        search: 'Mina',
        scope: 'global',
      },
      platformAccountFlatListQueryConfig,
    );

    expect(inferred.get('ownerKind')).toBe('ORG_UNIT');
    expect(inferred.get('ownerOrgUnitId')).toBe('ou-1');
    expect(inferred.get('ownerTalentId')).toBeNull();
    expect(inferred.get('scope')).toBeNull();
  });

  it('submits create payloads with exactly one matching owner id and at least one locator', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <PlatformAccountCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByLabelText(i18n.t('platform-account:fields.accountCode')), 'PAWAVE');
    await user.type(screen.getByLabelText(i18n.t('platform-account:fields.platform')), 'YOUTUBE');
    await user.type(
      screen.getByLabelText(i18n.t('platform-account:fields.platformSurfaceType')),
      'LIVESTREAM',
    );
    await user.type(
      screen.getByLabelText(i18n.t('platform-account:fields.displayName')),
      'Wave Account',
    );
    await user.selectOptions(
      screen.getByLabelText(i18n.t('platform-account:fields.ownerKind')),
      'TALENT_GROUP',
    );
    await user.type(screen.getByLabelText(i18n.t('platform-account:fields.ownerId')), 'group-001');
    await user.type(
      screen.getByLabelText(i18n.t('platform-account:fields.profileUrl')),
      'https://p.test/wave',
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('platform-account:mutations.create.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      accountCode: 'PAWAVE',
      platform: 'YOUTUBE',
      platformSurfaceType: 'LIVESTREAM',
      displayName: 'Wave Account',
      ownerKind: 'TALENT_GROUP',
      ownerTalentGroupId: 'group-001',
      livestreamEnabled: true,
      contentPublishingEnabled: true,
      monetizationEnabled: false,
      handle: null,
      externalPlatformId: null,
      profileUrl: 'https://p.test/wave',
      description: null,
      externalRef: null,
    });
  });

  it('blocks create submission when all locator fields are empty', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <PlatformAccountCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByLabelText(i18n.t('platform-account:fields.accountCode')), 'PANOL');
    await user.type(screen.getByLabelText(i18n.t('platform-account:fields.platform')), 'YOUTUBE');
    await user.type(
      screen.getByLabelText(i18n.t('platform-account:fields.platformSurfaceType')),
      'LIVESTREAM',
    );
    await user.type(
      screen.getByLabelText(i18n.t('platform-account:fields.displayName')),
      'No Locator',
    );
    await user.type(screen.getByLabelText(i18n.t('platform-account:fields.ownerId')), 'ou-sales');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('platform-account:mutations.create.submit'),
      }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t('platform-account:validation.locatorRequired')),
    ).toBeInTheDocument();
  });

  it('normalizes edit-surface cleared locator and reference values to null', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <PlatformAccountEditSurface
        initialValues={{
          displayName: 'Mina Live',
          handle: '@mina',
          externalPlatformId: 'yt-1',
          profileUrl: 'https://p.test/mina',
          description: 'Desc',
          externalRef: 'EXT',
        }}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.clear(screen.getByLabelText(i18n.t('platform-account:fields.handle')));
    await user.clear(screen.getByLabelText(i18n.t('platform-account:fields.externalPlatformId')));
    await user.clear(screen.getByLabelText(i18n.t('platform-account:fields.profileUrl')));
    await user.clear(screen.getByLabelText(i18n.t('platform-account:fields.description')));
    await user.clear(screen.getByLabelText(i18n.t('platform-account:fields.externalRef')));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('platform-account:mutations.edit.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      displayName: 'Mina Live',
      handle: null,
      externalPlatformId: null,
      profileUrl: null,
      description: null,
      externalRef: null,
    });
  });

  it('submits ownership transfer and capability payloads with exact documented keys', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onTransfer = vi.fn();
    const onCapabilities = vi.fn();

    renderWithProviders(
      <PlatformAccountOwnershipTransferSurface
        initialValues={{
          ownerKind: 'ORG_UNIT',
          ownerOrgUnitId: 'ou-sales',
        }}
        onCancel={() => undefined}
        onSubmit={onTransfer}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText(i18n.t('platform-account:fields.ownerKind')),
      'TALENT',
    );
    await user.clear(screen.getByLabelText(i18n.t('platform-account:fields.ownerId')));
    await user.type(screen.getByLabelText(i18n.t('platform-account:fields.ownerId')), 'talent-001');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('platform-account:mutations.transferOwnership.submit'),
      }),
    );

    expect(onTransfer).toHaveBeenCalledWith({
      ownerKind: 'TALENT',
      ownerTalentId: 'talent-001',
    });

    renderWithProviders(
      <PlatformAccountCapabilitiesSurface
        initialValues={{
          livestreamEnabled: true,
          contentPublishingEnabled: true,
          monetizationEnabled: false,
        }}
        onCancel={() => undefined}
        onSubmit={onCapabilities}
      />,
    );
    await user.click(screen.getByLabelText(i18n.t('platform-account:fields.livestreamEnabled')));
    await user.click(
      screen.getByLabelText(i18n.t('platform-account:fields.contentPublishingEnabled')),
    );
    await user.click(screen.getByLabelText(i18n.t('platform-account:fields.monetizationEnabled')));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('platform-account:mutations.capabilities.submit'),
      }),
    );

    expect(onCapabilities).toHaveBeenCalledWith({
      livestreamEnabled: false,
      contentPublishingEnabled: false,
      monetizationEnabled: true,
    });
  });

  it('sends capability and lifecycle API requests without unsupported fields', async () => {
    mockedApiRequest.mockResolvedValue({
      data: {
        id: 'platform-001',
        accountCode: 'PA001',
        platform: 'YOUTUBE',
        platformSurfaceType: 'LIVESTREAM',
        displayName: 'Mina Live',
        handle: '@mina',
        externalPlatformId: null,
        profileUrl: null,
        ownerKind: 'TALENT',
        ownerOrgUnitId: null,
        ownerTalentId: 'talent-001',
        ownerTalentGroupId: null,
        operationalStatus: 'ACTIVE',
        livestreamEnabled: true,
        contentPublishingEnabled: false,
        monetizationEnabled: true,
        description: null,
        externalRef: null,
        createdAt: 1_000,
        updatedAt: 2_000,
      },
    });

    await updatePlatformAccountCapabilities('platform-001', {
      livestreamEnabled: true,
      contentPublishingEnabled: false,
      monetizationEnabled: true,
    });
    await performPlatformAccountLifecycleAction('platform-001', 'archive');

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      url: '/admin/platform-accounts/platform-001/capabilities',
      data: {
        livestreamEnabled: true,
        contentPublishingEnabled: false,
        monetizationEnabled: true,
      },
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, {
      method: 'POST',
      url: '/admin/platform-accounts/platform-001/archive',
      data: {},
    });
  });
});
