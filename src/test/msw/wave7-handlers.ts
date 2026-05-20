import { http, HttpResponse } from 'msw';

import {
  generatedFixtureYearCode,
  providedOrGeneratedFixtureCode,
} from '@test/msw/generated-code-fixtures';

type ContractStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'ARCHIVED';
type ContractKind = 'EMPLOYMENT' | 'TALENT_SERVICE' | 'TALENT_MANAGEMENT';
type LinkedEntityKind = 'EMPLOYMENT_PROFILE' | 'TALENT';
type ConfidentialityTier = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

type ReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  title?: string;
  displayName?: string;
  status?: string;
};

type ContractRecord = {
  id: string;
  contractCode: string;
  title: string;
  contractKind: ContractKind;
  linkedEntityKind: LinkedEntityKind;
  linkedEmploymentProfileId: string | null;
  linkedTalentId: string | null;
  ownerEmploymentProfileId: string;
  confidentialityTier: ConfidentialityTier;
  status: ContractStatus;
  effectiveStartDate: number;
  effectiveEndDate: number | null;
  fileReferenceId: string | null;
  fileDisplayName: string | null;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

const now = Date.parse('2026-04-22T00:00:00.000Z');
const day = 24 * 60 * 60 * 1000;
const initialContractSeed = 100;
let contractSeed = initialContractSeed;

const inputDateToTimestamp = (value: string): number => Date.parse(`${value}T00:00:00.000Z`);

const initialContracts: ContractRecord[] = [
  {
    id: 'contract-record-001',
    contractCode: 'CON-2026-000001',
    title: 'Alice employment contract',
    contractKind: 'EMPLOYMENT',
    linkedEntityKind: 'EMPLOYMENT_PROFILE',
    linkedEmploymentProfileId: 'ep-001',
    linkedTalentId: null,
    ownerEmploymentProfileId: 'ep-001',
    confidentialityTier: 'CONFIDENTIAL',
    status: 'DRAFT',
    effectiveStartDate: now - day * 30,
    effectiveEndDate: null,
    fileReferenceId: 'file-001',
    fileDisplayName: 'alice-contract.pdf',
    description: 'Employment metadata',
    externalRef: 'EXT-CON-001',
    createdAt: now - day * 40,
    updatedAt: now - day * 20,
  },
  {
    id: 'contract-record-active',
    contractCode: 'CON-2026-000002',
    title: 'Talent service contract',
    contractKind: 'TALENT_SERVICE',
    linkedEntityKind: 'TALENT',
    linkedEmploymentProfileId: null,
    linkedTalentId: 'talent-001',
    ownerEmploymentProfileId: 'ep-002',
    confidentialityTier: 'INTERNAL',
    status: 'ACTIVE',
    effectiveStartDate: now - day * 10,
    effectiveEndDate: null,
    fileReferenceId: null,
    fileDisplayName: null,
    description: null,
    externalRef: null,
    createdAt: now - day * 15,
    updatedAt: now - day * 9,
  },
  {
    id: 'contract-record-archived',
    contractCode: 'CON-2025-999999',
    title: 'Archived contract record',
    contractKind: 'EMPLOYMENT',
    linkedEntityKind: 'EMPLOYMENT_PROFILE',
    linkedEmploymentProfileId: 'ep-archive',
    linkedTalentId: null,
    ownerEmploymentProfileId: 'ep-001',
    confidentialityTier: 'RESTRICTED',
    status: 'ARCHIVED',
    effectiveStartDate: now - day * 400,
    effectiveEndDate: now - day * 200,
    fileReferenceId: null,
    fileDisplayName: null,
    description: null,
    externalRef: null,
    createdAt: now - day * 400,
    updatedAt: now - day * 200,
  },
];

let contracts = initialContracts.map((record) => ({ ...record }));

const employmentProfileRefs = new Map<string, ReferenceSummary>([
  ['ep-001', { id: 'ep-001', code: 'EMP-001', name: 'Alice Nguyen', status: 'ACTIVE' }],
  ['ep-002', { id: 'ep-002', code: 'EMP-002', name: 'Bao Tran', status: 'ACTIVE' }],
]);

const talentRefs = new Map<string, ReferenceSummary>([
  ['talent-001', { id: 'talent-001', code: 'TAL-001', name: 'Luna', status: 'ACTIVE' }],
]);

export const resetWave7MockData = (): void => {
  contractSeed = initialContractSeed;
  contracts = initialContracts.map((record) => ({ ...record }));
};

const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  if (!request.body) {
    return {};
  }

  const body = (await request.json().catch(() => ({}))) as unknown;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
};

const paginate = <TData>(
  items: TData[],
  searchParams: URLSearchParams,
): { data: TData[]; meta?: { nextCursor?: string } } => {
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);
  const cursor = Number(searchParams.get('cursor') ?? 0);
  const start = Number.isFinite(cursor) && cursor > 0 ? cursor : 0;
  const end = Math.min(start + limit, items.length);
  return {
    data: items.slice(start, end),
    meta: end < items.length ? { nextCursor: String(end) } : undefined,
  };
};

const allowedQueryKeys = {
  flat: new Set([
    'status',
    'contractKind',
    'linkedEntityKind',
    'linkedEmploymentProfileId',
    'linkedTalentId',
    'ownerEmploymentProfileId',
    'confidentialityTier',
    'hasFileReference',
    'windowStartDate',
    'windowEndDate',
    'limit',
    'cursor',
    'search',
    'sortBy',
    'sortDirection',
  ]),
  byLinkedEntity: new Set([
    'linkedEntityKind',
    'linkedEmploymentProfileId',
    'linkedTalentId',
    'status',
    'windowStartDate',
    'windowEndDate',
    'limit',
    'cursor',
    'sortBy',
    'sortDirection',
  ]),
  byOwner: new Set([
    'ownerEmploymentProfileId',
    'status',
    'windowStartDate',
    'windowEndDate',
    'limit',
    'cursor',
    'sortBy',
    'sortDirection',
  ]),
};

const rejectUnsupportedQuery = (searchParams: URLSearchParams, allowed: Set<string>) => {
  for (const key of searchParams.keys()) {
    if (!allowed.has(key) || key === 'scope' || key === 'scopeGrants') {
      return HttpResponse.json({ message: 'errors:validation.unsupportedQuery' }, { status: 422 });
    }
  }
  return undefined;
};

const hasLinkedEntityMismatch = (params: URLSearchParams): boolean => {
  const kind = params.get('linkedEntityKind');
  const epId = params.get('linkedEmploymentProfileId');
  const talentId = params.get('linkedTalentId');
  return (
    Boolean(epId && talentId) ||
    (kind === 'EMPLOYMENT_PROFILE' && Boolean(talentId)) ||
    (kind === 'TALENT' && Boolean(epId))
  );
};

const filterContracts = (
  rows: ContractRecord[],
  searchParams: URLSearchParams,
  requireLinkedIdentity = false,
): ContractRecord[] | Response => {
  if (hasLinkedEntityMismatch(searchParams)) {
    return HttpResponse.json(
      { message: 'contract-registry:validation.invalidLinkedEntity' },
      { status: 422 },
    );
  }

  if (requireLinkedIdentity) {
    const kind = searchParams.get('linkedEntityKind');
    if (
      (kind !== 'EMPLOYMENT_PROFILE' || !searchParams.get('linkedEmploymentProfileId')) &&
      (kind !== 'TALENT' || !searchParams.get('linkedTalentId'))
    ) {
      return HttpResponse.json(
        { message: 'contract-registry:validation.invalidLinkedEntity' },
        { status: 422 },
      );
    }
  }

  let next = [...rows];
  const status = searchParams.get('status');
  if (!status) {
    next = next.filter((record) => record.status !== 'ARCHIVED');
  } else {
    next = next.filter((record) => record.status === status);
  }

  const contractKind = searchParams.get('contractKind');
  if (contractKind) {
    next = next.filter((record) => record.contractKind === contractKind);
  }

  const linkedEntityKind = searchParams.get('linkedEntityKind');
  if (linkedEntityKind) {
    next = next.filter((record) => record.linkedEntityKind === linkedEntityKind);
  }

  const linkedEmploymentProfileId = searchParams.get('linkedEmploymentProfileId');
  if (linkedEmploymentProfileId) {
    next = next.filter((record) => record.linkedEmploymentProfileId === linkedEmploymentProfileId);
  }

  const linkedTalentId = searchParams.get('linkedTalentId');
  if (linkedTalentId) {
    next = next.filter((record) => record.linkedTalentId === linkedTalentId);
  }

  const ownerEmploymentProfileId = searchParams.get('ownerEmploymentProfileId');
  if (ownerEmploymentProfileId) {
    next = next.filter((record) => record.ownerEmploymentProfileId === ownerEmploymentProfileId);
  }

  const confidentialityTier = searchParams.get('confidentialityTier');
  if (confidentialityTier) {
    next = next.filter((record) => record.confidentialityTier === confidentialityTier);
  }

  const hasFileReference = searchParams.get('hasFileReference');
  if (hasFileReference === 'true' || hasFileReference === 'false') {
    next = next.filter(
      (record) => Boolean(record.fileReferenceId) === (hasFileReference === 'true'),
    );
  }

  const search = searchParams.get('search')?.toLowerCase();
  if (search) {
    next = next.filter(
      (record) =>
        record.contractCode.toLowerCase() === search ||
        record.title.toLowerCase().startsWith(search),
    );
  }

  return next.sort((left, right) => right.effectiveStartDate - left.effectiveStartDate);
};

const toListItem = (record: ContractRecord) => ({
  id: record.id,
  contractCode: record.contractCode,
  title: record.title,
  contractKind: record.contractKind,
  linkedEntityKind: record.linkedEntityKind,
  linkedEmploymentProfileId: record.linkedEmploymentProfileId,
  linkedTalentId: record.linkedTalentId,
  ownerEmploymentProfileId: record.ownerEmploymentProfileId,
  linkedEmploymentProfileRef: record.linkedEmploymentProfileId
    ? (employmentProfileRefs.get(record.linkedEmploymentProfileId) ?? null)
    : null,
  linkedTalentRef: record.linkedTalentId ? (talentRefs.get(record.linkedTalentId) ?? null) : null,
  ownerEmploymentProfileRef: employmentProfileRefs.get(record.ownerEmploymentProfileId) ?? null,
  confidentialityTier: record.confidentialityTier,
  status: record.status,
  effectiveStartDate: record.effectiveStartDate,
  effectiveEndDate: record.effectiveEndDate,
  createdAt: record.createdAt,
});

const toDetail = (record: ContractRecord) => ({
  ...toListItem(record),
  updatedAt: record.updatedAt,
  fileReferenceId: record.fileReferenceId,
  fileDisplayName: record.fileDisplayName,
  description: record.description,
  externalRef: record.externalRef,
});

const toByLinkedEntityItem = (record: ContractRecord) => ({
  id: record.id,
  contractCode: record.contractCode,
  title: record.title,
  contractKind: record.contractKind,
  linkedEntityKind: record.linkedEntityKind,
  linkedEmploymentProfileId: record.linkedEmploymentProfileId,
  linkedTalentId: record.linkedTalentId,
  linkedEmploymentProfileRef: record.linkedEmploymentProfileId
    ? (employmentProfileRefs.get(record.linkedEmploymentProfileId) ?? null)
    : null,
  linkedTalentRef: record.linkedTalentId ? (talentRefs.get(record.linkedTalentId) ?? null) : null,
  status: record.status,
  effectiveStartDate: record.effectiveStartDate,
  effectiveEndDate: record.effectiveEndDate,
});

const toByOwnerItem = (record: ContractRecord) => ({
  id: record.id,
  contractCode: record.contractCode,
  title: record.title,
  contractKind: record.contractKind,
  ownerEmploymentProfileId: record.ownerEmploymentProfileId,
  ownerEmploymentProfileRef: employmentProfileRefs.get(record.ownerEmploymentProfileId) ?? null,
  confidentialityTier: record.confidentialityTier,
  status: record.status,
  effectiveStartDate: record.effectiveStartDate,
  effectiveEndDate: record.effectiveEndDate,
});

const rejectUnsupportedBody = (body: Record<string, unknown>, allowed: Set<string>) => {
  for (const key of Object.keys(body)) {
    if (!allowed.has(key) || key === 'scope' || key === 'scopeGrants') {
      return HttpResponse.json({ message: 'errors:validation.unsupportedBody' }, { status: 422 });
    }
  }
  return undefined;
};

const contractKindMatchesLinkedKind = (
  contractKind: ContractKind,
  linkedEntityKind: LinkedEntityKind,
): boolean => {
  return contractKind === 'EMPLOYMENT'
    ? linkedEntityKind === 'EMPLOYMENT_PROFILE'
    : linkedEntityKind === 'TALENT';
};

const findContract = (contractRecordId: string): ContractRecord | undefined =>
  contracts.find((record) => record.id === contractRecordId);

const rejectInvalidTransition = (): Response =>
  HttpResponse.json({ message: 'errors:validation.conflict' }, { status: 409 });

const ensureNonArchived = (record: ContractRecord): Response | undefined =>
  record.status === 'ARCHIVED' ? rejectInvalidTransition() : undefined;

const transitionRules: Record<ContractStatus, readonly ContractStatus[]> = {
  DRAFT: ['PENDING_SIGNATURE', 'ACTIVE', 'ARCHIVED'],
  PENDING_SIGNATURE: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
  ACTIVE: ['EXPIRED', 'TERMINATED'],
  EXPIRED: ['ARCHIVED'],
  TERMINATED: ['ARCHIVED'],
  ARCHIVED: [],
};

const setLifecycleStatus = (record: ContractRecord, status: ContractStatus): Response => {
  if (!transitionRules[record.status].includes(status)) {
    return rejectInvalidTransition();
  }
  record.status = status;
  record.updatedAt = Date.now();
  return HttpResponse.json({ data: toDetail(record) });
};

const isValidFileReferencePair = (body: Record<string, unknown>): boolean => {
  const hasFileReferenceId = Object.hasOwn(body, 'newFileReferenceId');
  const hasFileDisplayName = Object.hasOwn(body, 'newFileDisplayName');
  if (!hasFileReferenceId || !hasFileDisplayName) {
    return false;
  }

  if (body.newFileReferenceId === null && body.newFileDisplayName === null) {
    return true;
  }

  return typeof body.newFileReferenceId === 'string' && typeof body.newFileDisplayName === 'string';
};

export const wave7Handlers = [
  http.get('*/admin/contract-records/by-linked-entity', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, allowedQueryKeys.byLinkedEntity);
    if (unsupported) {
      return unsupported;
    }
    const rows = filterContracts(contracts, url.searchParams, true);
    if (rows instanceof Response) {
      return rows;
    }
    return HttpResponse.json(paginate(rows.map(toByLinkedEntityItem), url.searchParams));
  }),
  http.get('*/admin/contract-records/by-owner', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, allowedQueryKeys.byOwner);
    if (unsupported) {
      return unsupported;
    }
    if (!url.searchParams.get('ownerEmploymentProfileId')) {
      return HttpResponse.json(
        { message: 'contract-registry:validation.required' },
        { status: 422 },
      );
    }
    const rows = filterContracts(contracts, url.searchParams);
    if (rows instanceof Response) {
      return rows;
    }
    return HttpResponse.json(paginate(rows.map(toByOwnerItem), url.searchParams));
  }),
  http.get('*/admin/contract-records', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, allowedQueryKeys.flat);
    if (unsupported) {
      return unsupported;
    }
    const rows = filterContracts(contracts, url.searchParams);
    if (rows instanceof Response) {
      return rows;
    }
    return HttpResponse.json(paginate(rows.map(toListItem), url.searchParams));
  }),
  http.post('*/admin/contract-records', async ({ request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(
      body,
      new Set([
        'contractCode',
        'title',
        'contractKind',
        'linkedEntityKind',
        'linkedEmploymentProfileId',
        'linkedTalentId',
        'ownerEmploymentProfileId',
        'confidentialityTier',
        'effectiveStartDate',
        'effectiveEndDate',
        'fileReferenceId',
        'fileDisplayName',
        'description',
        'externalRef',
      ]),
    );
    if (unsupported) {
      return unsupported;
    }
    const contractKind = body.contractKind as ContractKind;
    const linkedEntityKind = body.linkedEntityKind as LinkedEntityKind;
    if (
      !contractKindMatchesLinkedKind(contractKind, linkedEntityKind) ||
      hasLinkedEntityMismatch(
        new URLSearchParams({
          linkedEntityKind,
          linkedEmploymentProfileId:
            typeof body.linkedEmploymentProfileId === 'string'
              ? body.linkedEmploymentProfileId
              : '',
          linkedTalentId: typeof body.linkedTalentId === 'string' ? body.linkedTalentId : '',
        }),
      )
    ) {
      return HttpResponse.json(
        { message: 'contract-registry:validation.kindCompatibility' },
        { status: 422 },
      );
    }
    if (Boolean(body.fileReferenceId) !== Boolean(body.fileDisplayName)) {
      return HttpResponse.json(
        { message: 'contract-registry:validation.filePair' },
        { status: 422 },
      );
    }

    contractSeed += 1;
    const next: ContractRecord = {
      id: `contract-record-${contractSeed}`,
      contractCode: providedOrGeneratedFixtureCode(
        body.contractCode,
        generatedFixtureYearCode(
          'CON',
          typeof body.effectiveStartDate === 'string'
            ? inputDateToTimestamp(body.effectiveStartDate)
            : undefined,
          contractSeed,
        ),
      ),
      title: String(body.title),
      contractKind,
      linkedEntityKind,
      linkedEmploymentProfileId:
        linkedEntityKind === 'EMPLOYMENT_PROFILE' ? String(body.linkedEmploymentProfileId) : null,
      linkedTalentId: linkedEntityKind === 'TALENT' ? String(body.linkedTalentId) : null,
      ownerEmploymentProfileId: String(body.ownerEmploymentProfileId),
      confidentialityTier: body.confidentialityTier as ConfidentialityTier,
      status: 'DRAFT',
      effectiveStartDate: inputDateToTimestamp(String(body.effectiveStartDate)),
      effectiveEndDate:
        typeof body.effectiveEndDate === 'string'
          ? inputDateToTimestamp(body.effectiveEndDate)
          : null,
      fileReferenceId: typeof body.fileReferenceId === 'string' ? body.fileReferenceId : null,
      fileDisplayName: typeof body.fileDisplayName === 'string' ? body.fileDisplayName : null,
      description: typeof body.description === 'string' ? body.description : null,
      externalRef: typeof body.externalRef === 'string' ? body.externalRef : null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    contracts.unshift(next);
    return HttpResponse.json({ data: toDetail(next) });
  }),
  http.get('*/admin/contract-records/:contractRecordId', ({ params }) => {
    const record = findContract(String(params.contractRecordId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    return HttpResponse.json({ data: toDetail(record) });
  }),
  http.patch(
    '*/admin/contract-records/:contractRecordId/draft-core',
    async ({ params, request }) => {
      const record = findContract(String(params.contractRecordId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(
        body,
        new Set([
          'title',
          'linkedEntityKind',
          'linkedEmploymentProfileId',
          'linkedTalentId',
          'confidentialityTier',
          'effectiveStartDate',
          'effectiveEndDate',
          'description',
          'externalRef',
        ]),
      );
      if (unsupported) {
        return unsupported;
      }
      if (record.status !== 'DRAFT' && record.status !== 'PENDING_SIGNATURE') {
        return HttpResponse.json({ message: 'errors:validation.conflict' }, { status: 409 });
      }
      record.title = typeof body.title === 'string' ? body.title : record.title;
      if (body.linkedEntityKind === 'EMPLOYMENT_PROFILE' || body.linkedEntityKind === 'TALENT') {
        record.linkedEntityKind = body.linkedEntityKind;
        record.linkedEmploymentProfileId =
          body.linkedEntityKind === 'EMPLOYMENT_PROFILE' &&
          typeof body.linkedEmploymentProfileId === 'string'
            ? body.linkedEmploymentProfileId
            : null;
        record.linkedTalentId =
          body.linkedEntityKind === 'TALENT' && typeof body.linkedTalentId === 'string'
            ? body.linkedTalentId
            : null;
      }
      record.confidentialityTier =
        typeof body.confidentialityTier === 'string'
          ? (body.confidentialityTier as ConfidentialityTier)
          : record.confidentialityTier;
      record.effectiveStartDate =
        typeof body.effectiveStartDate === 'string'
          ? inputDateToTimestamp(body.effectiveStartDate)
          : record.effectiveStartDate;
      record.effectiveEndDate =
        body.effectiveEndDate === null
          ? null
          : typeof body.effectiveEndDate === 'string'
            ? inputDateToTimestamp(body.effectiveEndDate)
            : record.effectiveEndDate;
      record.description = (body.description as string | null | undefined) ?? record.description;
      record.externalRef = (body.externalRef as string | null | undefined) ?? record.externalRef;
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: toDetail(record) });
    },
  ),
  http.post(
    '*/admin/contract-records/:contractRecordId/assign-owner',
    async ({ params, request }) => {
      const record = findContract(String(params.contractRecordId));
      const body = await parseJsonBody(request);
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedBody(body, new Set(['newOwnerEmploymentProfileId']));
      if (unsupported) {
        return unsupported;
      }
      const archived = ensureNonArchived(record);
      if (archived) {
        return archived;
      }
      record.ownerEmploymentProfileId = String(body.newOwnerEmploymentProfileId);
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: toDetail(record) });
    },
  ),
  http.post(
    '*/admin/contract-records/:contractRecordId/file-reference',
    async ({ params, request }) => {
      const record = findContract(String(params.contractRecordId));
      const body = await parseJsonBody(request);
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedBody(
        body,
        new Set(['newFileReferenceId', 'newFileDisplayName']),
      );
      if (unsupported) {
        return unsupported;
      }
      const archived = ensureNonArchived(record);
      if (archived) {
        return archived;
      }
      if (!isValidFileReferencePair(body)) {
        return HttpResponse.json(
          { message: 'contract-registry:validation.filePair' },
          { status: 422 },
        );
      }
      record.fileReferenceId = body.newFileReferenceId as string | null;
      record.fileDisplayName = body.newFileDisplayName as string | null;
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: toDetail(record) });
    },
  ),
  http.post('*/admin/contract-records/:contractRecordId/expire', async ({ params, request }) => {
    const record = findContract(String(params.contractRecordId));
    const body = await parseJsonBody(request);
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    const unsupported = rejectUnsupportedBody(body, new Set(['expiryDate']));
    if (unsupported) {
      return unsupported;
    }
    if (record.status !== 'ACTIVE') {
      return rejectInvalidTransition();
    }
    record.effectiveEndDate = inputDateToTimestamp(String(body.expiryDate));
    return setLifecycleStatus(record, 'EXPIRED');
  }),
  http.post('*/admin/contract-records/:contractRecordId/terminate', async ({ params, request }) => {
    const record = findContract(String(params.contractRecordId));
    const body = await parseJsonBody(request);
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    const unsupported = rejectUnsupportedBody(body, new Set(['terminationDate']));
    if (unsupported) {
      return unsupported;
    }
    if (record.status !== 'ACTIVE') {
      return rejectInvalidTransition();
    }
    record.effectiveEndDate = inputDateToTimestamp(String(body.terminationDate));
    return setLifecycleStatus(record, 'TERMINATED');
  }),
  http.post(
    '*/admin/contract-records/:contractRecordId/mark-pending-signature',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, new Set());
      if (unsupported) {
        return unsupported;
      }
      const record = findContract(String(params.contractRecordId));
      return record
        ? setLifecycleStatus(record, 'PENDING_SIGNATURE')
        : HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    },
  ),
  http.post(
    '*/admin/contract-records/:contractRecordId/reopen-draft',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, new Set());
      if (unsupported) {
        return unsupported;
      }
      const record = findContract(String(params.contractRecordId));
      return record
        ? setLifecycleStatus(record, 'DRAFT')
        : HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    },
  ),
  http.post('*/admin/contract-records/:contractRecordId/activate', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, new Set());
    if (unsupported) {
      return unsupported;
    }
    const record = findContract(String(params.contractRecordId));
    return record
      ? setLifecycleStatus(record, 'ACTIVE')
      : HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
  }),
  http.post('*/admin/contract-records/:contractRecordId/archive', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, new Set());
    if (unsupported) {
      return unsupported;
    }
    const record = findContract(String(params.contractRecordId));
    return record
      ? setLifecycleStatus(record, 'ARCHIVED')
      : HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
  }),
];
