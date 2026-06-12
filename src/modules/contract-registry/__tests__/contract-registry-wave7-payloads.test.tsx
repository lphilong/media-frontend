import i18n from 'i18next';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  assignContractOwner,
  createContractRecord,
  expireContractRecord,
  fetchContractRecordDetail,
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

vi.mock('@shared/components/reference/admin-reference-options', () => ({
  loadEmploymentProfileReferenceOptions: vi.fn(async () => [
    { id: 'ep-001', label: 'Employee One - EP-000001' },
    { id: 'ep-002', label: 'Employee Two - EP-000002' },
  ]),
  loadTalentReferenceOptions: vi.fn(async () => [
    { id: 'talent-001', label: 'Talent One - TAL-000001' },
  ]),
}));

const apiRequestMock = vi.mocked(apiRequest);

const legacyBoundaryMetadata = {
  semanticBoundary: 'LEGACY_EMPLOYMENT',
  kindClassification: 'LEGACY_EMPLOYMENT_DEPRECATED',
  commercialLegalRegistry: false,
  commercialChainContextEligible: false,
  directRevenueSourceEligible: false,
  directCommissionSourceEligible: false,
  payrollSourceEligible: false,
  obligationAcceptanceImplemented: false,
  eventEvidenceLinkImplemented: false,
} as const;

const commercialBoundaryMetadata = {
  semanticBoundary: 'COMMERCIAL_LEGAL',
  kindClassification: 'COMMERCIAL_LEGAL_SUPPORTED',
  commercialLegalRegistry: true,
  commercialChainContextEligible: true,
  directRevenueSourceEligible: false,
  directCommissionSourceEligible: false,
  payrollSourceEligible: false,
  obligationAcceptanceImplemented: false,
  eventEvidenceLinkImplemented: false,
} as const;

const unsupportedBoundaryMetadata = {
  semanticBoundary: 'UNSUPPORTED',
  kindClassification: 'UNSUPPORTED_CONTRACT_KIND',
  commercialLegalRegistry: false,
  commercialChainContextEligible: false,
  directRevenueSourceEligible: false,
  directCommissionSourceEligible: false,
  payrollSourceEligible: false,
  obligationAcceptanceImplemented: false,
  eventEvidenceLinkImplemented: false,
} as const;

const detailRecord: ContractRecord = {
  id: 'contract-record-001',
  contractCode: 'CON-2026-000001',
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
  boundaryMetadata: legacyBoundaryMetadata,
  createdAt: 1,
  updatedAt: 2,
};

const listRecord = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: detailRecord.id,
  contractCode: detailRecord.contractCode,
  title: detailRecord.title,
  contractKind: detailRecord.contractKind,
  linkedEntityKind: detailRecord.linkedEntityKind,
  linkedEmploymentProfileId: detailRecord.linkedEmploymentProfileId,
  linkedTalentId: detailRecord.linkedTalentId,
  ownerEmploymentProfileId: detailRecord.ownerEmploymentProfileId,
  confidentialityTier: detailRecord.confidentialityTier,
  status: detailRecord.status,
  effectiveStartDate: detailRecord.effectiveStartDate,
  effectiveEndDate: detailRecord.effectiveEndDate,
  boundaryMetadata: detailRecord.boundaryMetadata,
  createdAt: detailRecord.createdAt,
  ...overrides,
});

describe('contract registry wave 7 query and payload shaping', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setLocale(DEFAULT_LOCALE);
  });

  it('parses and serializes flat-list query keys without scope or numbered pagination', () => {
    const query = parseScreenQueryParams(
      new URLSearchParams(
        'status=DRAFT&contractKind=EMPLOYMENT&linkedEntityKind=EMPLOYMENT_PROFILE&linkedEmploymentProfileId=ep-001&ownerEmploymentProfileId=ep-002&confidentialityTier=CONFIDENTIAL&hasFileReference=true&windowStartDate=2026-01-01&windowEndDate=2026-12-31&limit=50&cursor=opaque&search=CON-2026-000001&sortBy=contractCode&sortDirection=desc&page=2&scope=global&scopeGrants=x',
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
      search: 'CON-2026-000001',
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

  it('accepts Contract Registry effective-end target filters and serializes URL/API params', async () => {
    const query = parseScreenQueryParams(
      new URLSearchParams(
        'status=ACTIVE&effectiveEndDateFrom=2026-05-01&effectiveEndDateTo=2026-05-31&windowStartDate=2026-01-01&windowEndDate=2026-12-31',
      ),
      contractRegistryFlatListQueryConfig,
    );

    expect(query).toEqual({
      status: 'ACTIVE',
      windowStartDate: '2026-01-01',
      windowEndDate: '2026-12-31',
      effectiveEndDateFrom: '2026-05-01',
      effectiveEndDateTo: '2026-05-31',
    });

    const params = serializeScreenQueryParams(query, contractRegistryFlatListQueryConfig);
    expect(params.get('status')).toBe('ACTIVE');
    expect(params.get('windowStartDate')).toBe('2026-01-01');
    expect(params.get('windowEndDate')).toBe('2026-12-31');
    expect(params.get('effectiveEndDateFrom')).toBe('2026-05-01');
    expect(params.get('effectiveEndDateTo')).toBe('2026-05-31');

    const invalid = serializeScreenQueryParams(
      {
        effectiveEndDateFrom: '2026-06-01',
        effectiveEndDateTo: '2026-05-01',
        windowStartDate: '2026-02-30',
      },
      contractRegistryFlatListQueryConfig,
    );
    expect(invalid.get('effectiveEndDateFrom')).toBeNull();
    expect(invalid.get('effectiveEndDateTo')).toBeNull();
    expect(invalid.get('windowStartDate')).toBeNull();

    apiRequestMock.mockResolvedValue({ data: [], meta: undefined });
    await fetchContractRecords(query);
    expect(apiRequestMock.mock.calls.at(-1)?.[0].params).toMatchObject({
      status: 'ACTIVE',
      windowStartDate: '2026-01-01',
      windowEndDate: '2026-12-31',
      effectiveEndDateFrom: '2026-05-01',
      effectiveEndDateTo: '2026-05-31',
    });
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
      title: 'Wave 7 contract',
      contractKind: 'TALENT_SERVICE',
      linkedEntityKind: 'TALENT',
      linkedTalentId: 'talent-001',
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
      title: 'Wave 7 contract',
      contractKind: 'TALENT_SERVICE',
      linkedEntityKind: 'TALENT',
      linkedTalentId: 'talent-001',
      ownerEmploymentProfileId: 'ep-001',
      confidentialityTier: 'CONFIDENTIAL',
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: null,
      fileReferenceId: 'file-001',
      fileDisplayName: 'file.pdf',
      description: null,
      externalRef: null,
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('contractCode');
  });

  it('rejects EMPLOYMENT create payloads before an API request can be sent', async () => {
    await expect(
      createContractRecord({
        title: 'Legacy employment contract',
        contractKind: 'EMPLOYMENT',
        linkedEntityKind: 'EMPLOYMENT_PROFILE',
        linkedEmploymentProfileId: 'ep-001',
        ownerEmploymentProfileId: 'ep-001',
        confidentialityTier: 'CONFIDENTIAL',
        effectiveStartDate: '2026-01-01',
      } as unknown as Parameters<typeof createContractRecord>[0]),
    ).rejects.toThrow(/EMPLOYMENT/);
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it('keeps the API parser strict for backend confidentiality tiers', async () => {
    apiRequestMock.mockResolvedValue({
      data: [
        listRecord({ id: 'contract-internal', confidentialityTier: 'INTERNAL' }),
        listRecord({ id: 'contract-confidential', confidentialityTier: 'CONFIDENTIAL' }),
        listRecord({ id: 'contract-restricted', confidentialityTier: 'RESTRICTED' }),
      ],
      meta: undefined,
    });

    await expect(fetchContractRecords({})).resolves.toMatchObject({
      data: [
        { confidentialityTier: 'INTERNAL' },
        { confidentialityTier: 'CONFIDENTIAL' },
        { confidentialityTier: 'RESTRICTED' },
      ],
    });

    apiRequestMock.mockResolvedValue({
      data: [listRecord({ confidentialityTier: 'STANDARD' })],
      meta: undefined,
    });

    await expect(fetchContractRecords({})).rejects.toThrow(/STANDARD/);
  });

  it('parses boundary metadata on list, detail, and mutation responses while remaining strict', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [listRecord()],
      meta: undefined,
    });
    await expect(fetchContractRecords({})).resolves.toMatchObject({
      data: [{ boundaryMetadata: legacyBoundaryMetadata }],
    });

    apiRequestMock.mockResolvedValueOnce({
      data: [
        listRecord({
          contractKind: 'FUTURE_CONTRACT_KIND',
          boundaryMetadata: unsupportedBoundaryMetadata,
        }),
      ],
      meta: undefined,
    });
    await expect(fetchContractRecords({})).resolves.toMatchObject({
      data: [
        {
          contractKind: 'FUTURE_CONTRACT_KIND',
          boundaryMetadata: unsupportedBoundaryMetadata,
        },
      ],
    });

    apiRequestMock.mockResolvedValueOnce({ data: detailRecord });
    await expect(fetchContractRecordDetail(detailRecord.id)).resolves.toMatchObject({
      boundaryMetadata: legacyBoundaryMetadata,
    });

    apiRequestMock.mockResolvedValueOnce({ data: detailRecord });
    await expect(
      createContractRecord({
        title: 'Commercial agreement',
        contractKind: 'TALENT_SERVICE',
        linkedEntityKind: 'TALENT',
        linkedTalentId: 'talent-001',
        ownerEmploymentProfileId: 'ep-001',
        confidentialityTier: 'CONFIDENTIAL',
        effectiveStartDate: '2026-01-01',
        boundaryMetadata: legacyBoundaryMetadata,
      } as Parameters<typeof createContractRecord>[0]),
    ).resolves.toMatchObject({
      boundaryMetadata: legacyBoundaryMetadata,
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('boundaryMetadata');

    apiRequestMock.mockResolvedValueOnce({
      data: [listRecord({ unsupportedField: true })],
      meta: undefined,
    });
    await expect(fetchContractRecords({})).rejects.toThrow(/unsupportedField/);
  });

  it('submits exact mutation payloads for draft-core, owner, file reference, dates, and zero-body lifecycle', async () => {
    apiRequestMock.mockResolvedValue({ data: detailRecord });

    await updateContractDraftCore('contract-record-001', {
      title: 'Changed',
      linkedEntityKind: 'TALENT',
      linkedTalentId: 'talent-001',
      linkedEmploymentProfileId: 'ep-forbidden',
      confidentialityTier: 'INTERNAL',
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: null,
      description: null,
      externalRef: null,
      ownerEmploymentProfileId: 'forbidden',
      fileReferenceId: 'forbidden',
      boundaryMetadata: legacyBoundaryMetadata,
    } as Parameters<typeof updateContractDraftCore>[1]);
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({
      title: 'Changed',
      linkedEntityKind: 'TALENT',
      linkedTalentId: 'talent-001',
      linkedEmploymentProfileId: null,
      confidentialityTier: 'INTERNAL',
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: null,
      description: null,
      externalRef: null,
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('contractCode');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('boundaryMetadata');

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
    expect(
      screen.queryByLabelText(i18n.t('contract-registry:fields.contractCode')),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('contract-registry:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('contract-registry:fields.title')), 'Contract');
    expect(screen.getByLabelText(i18n.t('contract-registry:fields.contractKind'))).toHaveValue(
      'TALENT_SERVICE',
    );
    expect(
      within(screen.getByLabelText(i18n.t('contract-registry:fields.contractKind'))).queryByRole(
        'option',
        { name: i18n.t('contract-registry:contractKinds.EMPLOYMENT') },
      ),
    ).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Talent One/ }));
    await user.click(await screen.findByRole('button', { name: /Employee One/ }));
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
        linkedEntityKind: 'TALENT',
        linkedTalentId: 'talent-001',
        effectiveStartDate: '2026-01-01',
        fileReferenceId: 'file-001',
        fileDisplayName: 'file.pdf',
      }),
    );
    expect(onCreate.mock.calls.at(-1)?.[0]).not.toHaveProperty('linkedEmploymentProfileId');
    expect(onCreate.mock.calls.at(-1)?.[0]).not.toHaveProperty('contractCode');
    createRender.unmount();
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
    expect(
      screen.queryByRole('combobox', {
        name: i18n.t('contract-registry:fields.linkedEntityKind'),
      }),
    ).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(i18n.t('contract-registry:fields.title')));
    await user.type(
      screen.getByLabelText(i18n.t('contract-registry:fields.title')),
      'Legacy metadata update',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('contract-registry:mutations.draftCore.submit') }),
    );
    expect(onDraftCore).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedEntityKind: 'EMPLOYMENT_PROFILE',
        linkedEmploymentProfileId: 'ep-001',
      }),
    );
    expect(onDraftCore.mock.calls.at(-1)?.[0]).not.toHaveProperty('contractCode');
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
    expect(draftItems.find((item) => item.id === 'mark-pending-signature')?.disabled).toBe(true);
    expect(draftItems.find((item) => item.id === 'activate')?.disabled).toBe(true);
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

    const commercialItems = createContractActionRailItems(
      i18n.t,
      {
        ...detailRecord,
        contractKind: 'TALENT_SERVICE',
        linkedEntityKind: 'TALENT',
        linkedEmploymentProfileId: null,
        linkedTalentId: 'talent-001',
        boundaryMetadata: commercialBoundaryMetadata,
      },
      {
        onDraftCoreEdit: vi.fn(),
        onAssignOwner: vi.fn(),
        onUpdateFileReference: vi.fn(),
        onExpire: vi.fn(),
        onTerminate: vi.fn(),
        onLifecycleAction: vi.fn(),
      },
    );
    expect(
      commercialItems.find((item) => item.id === 'mark-pending-signature')?.disabled,
    ).toBeFalsy();
    expect(commercialItems.find((item) => item.id === 'activate')?.disabled).toBeFalsy();
  });
});
