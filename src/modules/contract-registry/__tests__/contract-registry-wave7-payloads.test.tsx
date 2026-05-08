import i18n from 'i18next';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  assignContractOwner,
  createContractRecord,
  expireContractRecord,
  fetchContractRecords,
  performContractLifecycleAction,
  terminateContractRecord,
  updateContractDraftCore,
  updateContractFileReference,
} from '@modules/contract-registry/api/contract-registry.api';
import { createContractActionRailItems } from '@modules/contract-registry/actions/contract-registry-action-rail';
import {
  ContractCreateSurface,
  ContractDateActionSurface,
  ContractDraftCoreSurface,
  ContractFileReferenceSurface,
} from '@modules/contract-registry/forms/contract-registry-mutation-forms';
import type { ContractRecord } from '@modules/contract-registry/types/contract-registry.types';
import { apiRequest } from '@shared/api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  contractRegistryByLinkedEntityQueryConfig,
  contractRegistryByOwnerQueryConfig,
  contractRegistryFlatListQueryConfig,
  mergeScreenQueryParams,
  parseScreenQueryParams,
  serializeScreenQueryParams,
} from '@shared/query';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

const detailRecord: ContractRecord = {
  id: 'contract-record-001',
  contractCode: 'CON001',
  title: 'Contract one',
  contractKind: 'EMPLOYMENT',
  linkedEntityKind: 'EMPLOYMENT_PROFILE',
  linkedEmploymentProfileId: 'ep-001',
  linkedTalentId: null,
  ownerEmploymentProfileId: 'ep-001',
  confidentialityTier: 'CONFIDENTIAL',
  status: 'DRAFT',
  effectiveStartDate: 1_700_000_000_000,
  effectiveEndDate: null,
  fileReferenceId: 'file-001',
  fileDisplayName: 'contract.pdf',
  description: null,
  externalRef: null,
  createdAt: 1,
  updatedAt: 2,
};

describe('contract registry wave 7 query and payload shaping', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setLocale(DEFAULT_LOCALE);
  });

  it('parses and serializes flat-list query keys without scope or numbered pagination', () => {
    const query = parseScreenQueryParams(
      new URLSearchParams(
        'status=DRAFT&contractKind=EMPLOYMENT&linkedEntityKind=EMPLOYMENT_PROFILE&linkedEmploymentProfileId=ep-001&ownerEmploymentProfileId=ep-002&confidentialityTier=CONFIDENTIAL&hasFileReference=true&windowStartDate=2026-01-01&windowEndDate=2026-12-31&limit=50&cursor=opaque&search=CON001&sortBy=contractCode&sortDirection=desc&page=2&scope=global&scopeGrants=x',
      ),
      contractRegistryFlatListQueryConfig,
    );

    expect(query).toEqual({
      status: 'DRAFT',
      contractKind: 'EMPLOYMENT',
      linkedEntityKind: 'EMPLOYMENT_PROFILE',
      linkedEmploymentProfileId: 'ep-001',
      ownerEmploymentProfileId: 'ep-002',
      confidentialityTier: 'CONFIDENTIAL',
      hasFileReference: true,
      windowStartDate: '2026-01-01',
      windowEndDate: '2026-12-31',
      limit: 50,
      cursor: 'opaque',
      search: 'CON001',
      sortBy: 'contractCode',
      sortDirection: 'desc',
    });

    const params = serializeScreenQueryParams(
      {
        ...query,
        page: 2,
        scope: 'global',
        scopeGrants: 'x',
      },
      contractRegistryFlatListQueryConfig,
    );
    expect(params.get('scope')).toBeNull();
    expect(params.get('scopeGrants')).toBeNull();
    expect(params.get('page')).toBeNull();
  });

  it('normalizes related queries fail-closed and forbids search on related routes', () => {
    const invalidLinked = parseScreenQueryParams(
      new URLSearchParams(
        'view=by-linked-entity&linkedEntityKind=EMPLOYMENT_PROFILE&linkedTalentId=talent-001&search=nope&scope=global',
      ),
      contractRegistryByLinkedEntityQueryConfig,
    );
    expect(invalidLinked.view).toBeUndefined();
    expect(invalidLinked.linkedTalentId).toBeUndefined();
    expect((invalidLinked as Record<string, unknown>).search).toBeUndefined();
    expect((invalidLinked as Record<string, unknown>).scope).toBeUndefined();

    const validLinked = parseScreenQueryParams(
      new URLSearchParams(
        'view=by-linked-entity&linkedEntityKind=TALENT&linkedTalentId=talent-001&windowStartDate=&windowEndDate=2026-12-31',
      ),
      contractRegistryByLinkedEntityQueryConfig,
    );
    expect(validLinked).toEqual({
      view: 'by-linked-entity',
      linkedEntityKind: 'TALENT',
      linkedTalentId: 'talent-001',
      windowEndDate: '2026-12-31',
    });

    const owner = parseScreenQueryParams(
      new URLSearchParams('view=by-owner&ownerEmploymentProfileId=ep-001&search=nope'),
      contractRegistryByOwnerQueryConfig,
    );
    expect(owner).toEqual({ view: 'by-owner', ownerEmploymentProfileId: 'ep-001' });
  });

  it('resets cursor when query shape changes', () => {
    const next = mergeScreenQueryParams(
      new URLSearchParams('status=DRAFT&cursor=opaque'),
      { status: 'ACTIVE' },
      contractRegistryFlatListQueryConfig,
      { resetCursorOnChange: true },
    );

    expect(next.get('status')).toBe('ACTIVE');
    expect(next.get('cursor')).toBeNull();
  });

  it('never sends scope or scopeGrants from API query/body builders', async () => {
    apiRequestMock.mockResolvedValue({ data: [], meta: undefined });
    await fetchContractRecords({
      status: 'DRAFT',
      scope: 'global',
      scopeGrants: ['x'],
    } as Parameters<typeof fetchContractRecords>[0]);
    expect(apiRequestMock.mock.calls.at(-1)?.[0].params).not.toHaveProperty('scope');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].params).not.toHaveProperty('scopeGrants');

    apiRequestMock.mockResolvedValue({ data: detailRecord });
    await createContractRecord({
      contractCode: 'CON900',
      title: 'Wave 7 contract',
      contractKind: 'EMPLOYMENT',
      linkedEntityKind: 'EMPLOYMENT_PROFILE',
      linkedEmploymentProfileId: 'ep-001',
      linkedTalentId: 'talent-forbidden',
      ownerEmploymentProfileId: 'ep-001',
      confidentialityTier: 'CONFIDENTIAL',
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: null,
      fileReferenceId: 'file-001',
      fileDisplayName: 'file.pdf',
      description: null,
      externalRef: null,
      scope: 'global',
      scopeGrants: ['x'],
    } as Parameters<typeof createContractRecord>[0]);
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({
      contractCode: 'CON900',
      title: 'Wave 7 contract',
      contractKind: 'EMPLOYMENT',
      linkedEntityKind: 'EMPLOYMENT_PROFILE',
      linkedEmploymentProfileId: 'ep-001',
      ownerEmploymentProfileId: 'ep-001',
      confidentialityTier: 'CONFIDENTIAL',
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: null,
      fileReferenceId: 'file-001',
      fileDisplayName: 'file.pdf',
      description: null,
      externalRef: null,
    });
  });

  it('submits exact mutation payloads for draft-core, owner, file reference, dates, and zero-body lifecycle', async () => {
    apiRequestMock.mockResolvedValue({ data: detailRecord });

    await updateContractDraftCore('contract-record-001', {
      title: 'Changed',
      linkedEntityKind: 'TALENT',
      linkedTalentId: 'talent-001',
      linkedEmploymentProfileId: 'ep-forbidden',
      confidentialityTier: 'STANDARD',
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: null,
      description: null,
      externalRef: null,
      ownerEmploymentProfileId: 'forbidden',
      fileReferenceId: 'forbidden',
    } as Parameters<typeof updateContractDraftCore>[1]);
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({
      title: 'Changed',
      linkedEntityKind: 'TALENT',
      linkedTalentId: 'talent-001',
      linkedEmploymentProfileId: null,
      confidentialityTier: 'STANDARD',
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: null,
      description: null,
      externalRef: null,
    });

    await assignContractOwner('contract-record-001', {
      newOwnerEmploymentProfileId: 'ep-002',
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({
      newOwnerEmploymentProfileId: 'ep-002',
    });

    await updateContractFileReference('contract-record-001', {
      newFileReferenceId: null,
      newFileDisplayName: null,
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({
      newFileReferenceId: null,
      newFileDisplayName: null,
    });

    await expireContractRecord('contract-record-001', { expiryDate: '2026-03-01' });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({ expiryDate: '2026-03-01' });

    await terminateContractRecord('contract-record-001', { terminationDate: '2026-03-02' });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({
      terminationDate: '2026-03-02',
    });

    await performContractLifecycleAction('contract-record-001', 'activate');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({});
  });

  it('form payloads enforce exact linked id, compatibility, file-pair, and YYYY-MM-DD dates', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const createRender = render(
      <ContractCreateSurface onCancel={() => undefined} onSubmit={onCreate} />,
    );
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.contractCode')),
      'CON900',
    );
    await user.type(screen.getByLabelText(i18n.t('contract-registry:fields.title')), 'Contract');
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.linkedEntityId')),
      'ep-001',
    );
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.ownerEmploymentProfileId')),
      'ep-001',
    );
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.effectiveStartDate')),
      '2026-01-01',
    );
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.fileReferenceId')),
      'file-001',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('contract-registry:mutations.create.submit') }),
    );
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(i18n.t('contract-registry:validation.filePair'))).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.fileDisplayName')),
      'file.pdf',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('contract-registry:mutations.create.submit') }),
    );
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedEntityKind: 'EMPLOYMENT_PROFILE',
        linkedEmploymentProfileId: 'ep-001',
        effectiveStartDate: '2026-01-01',
        fileReferenceId: 'file-001',
        fileDisplayName: 'file.pdf',
      }),
    );
    expect(onCreate.mock.calls.at(-1)?.[0]).not.toHaveProperty('linkedTalentId');
    createRender.unmount();

    const badCompatibility = vi.fn();
    render(<ContractCreateSurface onCancel={() => undefined} onSubmit={badCompatibility} />);
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.contractCode')),
      'CON901',
    );
    await user.type(screen.getByLabelText(i18n.t('contract-registry:fields.title')), 'Bad');
    await user.selectOptions(
      screen.getByLabelText(i18n.t('contract-registry:fields.contractKind')),
      'TALENT_SERVICE',
    );
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.linkedEntityId')),
      'ep-001',
    );
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.ownerEmploymentProfileId')),
      'ep-001',
    );
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.effectiveStartDate')),
      '2026-01-01',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('contract-registry:mutations.create.submit') }),
    );
    expect(badCompatibility).not.toHaveBeenCalled();
  }, 20_000);

  it('draft-core and action forms emit exact payloads', async () => {
    const user = userEvent.setup();
    const onDraftCore = vi.fn();
    const draftRender = render(
      <ContractDraftCoreSurface
        initialValues={detailRecord}
        onCancel={() => undefined}
        onSubmit={onDraftCore}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText(i18n.t('contract-registry:fields.linkedEntityKind')),
      'TALENT',
    );
    await user.clear(screen.getByLabelText(i18n.t('contract-registry:fields.linkedEntityId')));
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.linkedEntityId')),
      'talent-001',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('contract-registry:mutations.draftCore.submit') }),
    );
    expect(onDraftCore).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedEntityKind: 'TALENT',
        linkedTalentId: 'talent-001',
      }),
    );
    draftRender.unmount();

    const onFile = vi.fn();
    const fileRender = render(
      <ContractFileReferenceSurface
        initialFileReferenceId="file-001"
        initialFileDisplayName="file.pdf"
        onCancel={() => undefined}
        onSubmit={onFile}
      />,
    );
    await user.clear(screen.getByLabelText(i18n.t('contract-registry:fields.newFileReferenceId')));
    await user.clear(screen.getByLabelText(i18n.t('contract-registry:fields.newFileDisplayName')));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('contract-registry:mutations.fileReference.submit'),
      }),
    );
    expect(onFile).toHaveBeenCalledWith({
      newFileReferenceId: null,
      newFileDisplayName: null,
    });
    fileRender.unmount();

    const onExpire = vi.fn();
    render(
      <ContractDateActionSurface action="expire" onCancel={() => undefined} onSubmit={onExpire} />,
    );
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.expiryDate')),
      '2026-03-01',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('contract-registry:mutations.expire.submit') }),
    );
    expect(onExpire).toHaveBeenCalledWith({ expiryDate: '2026-03-01' });
  }, 20_000);

  it('gates lifecycle actions and archived read-only behavior', () => {
    const draftItems = createContractActionRailItems(i18n.t, detailRecord, {
      onDraftCoreEdit: vi.fn(),
      onAssignOwner: vi.fn(),
      onUpdateFileReference: vi.fn(),
      onExpire: vi.fn(),
      onTerminate: vi.fn(),
      onLifecycleAction: vi.fn(),
    });
    expect(draftItems.find((item) => item.id === 'draft-core')?.disabled).toBe(false);
    expect(draftItems.find((item) => item.id === 'mark-pending-signature')?.disabled).toBeFalsy();
    expect(draftItems.find((item) => item.id === 'expire')?.disabled).toBe(true);

    const archivedItems = createContractActionRailItems(
      i18n.t,
      { ...detailRecord, status: 'ARCHIVED' },
      {
        onDraftCoreEdit: vi.fn(),
        onAssignOwner: vi.fn(),
        onUpdateFileReference: vi.fn(),
        onExpire: vi.fn(),
        onTerminate: vi.fn(),
        onLifecycleAction: vi.fn(),
      },
    );
    expect(archivedItems.every((item) => item.disabled)).toBe(true);
  });
});
