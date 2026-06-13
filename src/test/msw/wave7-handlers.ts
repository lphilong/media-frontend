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
type ContractKind = string;
type LinkedEntityKind = 'EMPLOYMENT_PROFILE' | 'TALENT';
type ConfidentialityTier = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

type ContractBoundaryMetadata = {
  semanticBoundary: 'COMMERCIAL_LEGAL' | 'LEGACY_EMPLOYMENT' | 'UNSUPPORTED';
  kindClassification:
    | 'COMMERCIAL_LEGAL_SUPPORTED'
    | 'LEGACY_EMPLOYMENT_DEPRECATED'
    | 'UNSUPPORTED_CONTRACT_KIND';
  commercialLegalRegistry: boolean;
  commercialChainContextEligible: boolean;
  directRevenueSourceEligible: false;
  directCommissionSourceEligible: false;
  payrollSourceEligible: false;
  obligationAcceptanceImplemented: boolean;
  eventEvidenceLinkImplemented: boolean;
};

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

type ContractObligationStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'DELIVERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ARCHIVED';
type ContractObligationType = 'DELIVERABLE' | 'SERVICE_MILESTONE' | 'REPORTING' | 'OTHER';
type ContractObligationEvidencePolicy = 'OPTIONAL' | 'REQUIRED';
type ContractEvidenceRefType =
  | 'URL'
  | 'PLATFORM_REFERENCE'
  | 'EXTERNAL_REFERENCE'
  | 'INTERNAL_REFERENCE';
type ContractObligationEventEvidenceLinkStatus = 'ACTIVE' | 'REMOVED';

type ContractEvidenceRef = {
  type: ContractEvidenceRefType;
  label: string;
  url: string | null;
  referenceId: string | null;
};

type ContractObligation = {
  id: string;
  contractRecordId: string;
  code: string;
  obligationType: ContractObligationType;
  title: string;
  description: string | null;
  status: ContractObligationStatus;
  evidencePolicy: ContractObligationEvidencePolicy;
  dueDate: number | null;
  periodStartDate: number | null;
  periodEndDate: number | null;
  responsibleOwnerEmploymentProfileId: string;
  latestDeliveryNote: string | null;
  latestDeliveredAt: number | null;
  latestDeliveredBy: string | null;
  latestEvidenceRefs: ContractEvidenceRef[];
  latestEventEvidenceLinkIds: string[];
  latestReviewNote: string | null;
  latestReviewedAt: number | null;
  latestReviewedBy: string | null;
  latestRejectionReason: string | null;
  statusTransitions: Array<{
    fromStatus: ContractObligationStatus | null;
    toStatus: ContractObligationStatus;
    reason: string | null;
    actorId: string;
    happenedAt: number;
  }>;
  boundaryMetadata: {
    commercialLegalRegistry: boolean;
    obligationAcceptanceImplemented: boolean;
    eventEvidenceLinkImplemented: boolean;
    noRevenueSideEffect: true;
    noCommissionSideEffect: true;
    noPayrollSideEffect: true;
    noPaymentSideEffect: true;
    noTaxAccountingSideEffect: true;
    noFileStorageSideEffect: true;
  };
  createdAt: number;
  updatedAt: number;
};

type ContractObligationEventEvidenceLink = {
  id: string;
  obligationId: string;
  eventId: string;
  status: ContractObligationEventEvidenceLinkStatus;
  snapshot: {
    eventId: string;
    eventCode: string;
    eventTitle: string;
    eventStatus: 'COMPLETED';
    eventUpdatedAt: number;
    eventCompletedAt: number;
    eventCompletedBy: string;
    completionEvidenceNote: string;
    completionEvidenceRefs: ContractEvidenceRef[];
  };
  linkReason: string;
  linkedAt: number;
  linkedBy: string;
  removeReason: string | null;
  removedAt: number | null;
  removedBy: string | null;
  boundaryMetadata: {
    snapshotImmutable: true;
    activeLinkCanSatisfyDelivery: boolean;
    removedLinkCanSatisfyDelivery: boolean;
  };
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
    id: 'contract-record-future',
    contractCode: 'CON-2026-000003',
    title: 'Future contract kind',
    contractKind: 'FUTURE_CONTRACT_KIND',
    linkedEntityKind: 'TALENT',
    linkedEmploymentProfileId: null,
    linkedTalentId: 'talent-001',
    ownerEmploymentProfileId: 'ep-001',
    confidentialityTier: 'INTERNAL',
    status: 'DRAFT',
    effectiveStartDate: now - day * 5,
    effectiveEndDate: null,
    fileReferenceId: null,
    fileDisplayName: null,
    description: null,
    externalRef: null,
    createdAt: now - day * 6,
    updatedAt: now - day * 5,
  },
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

const obligationBoundaryMetadata: ContractObligation['boundaryMetadata'] = {
  commercialLegalRegistry: true,
  obligationAcceptanceImplemented: true,
  eventEvidenceLinkImplemented: true,
  noRevenueSideEffect: true,
  noCommissionSideEffect: true,
  noPayrollSideEffect: true,
  noPaymentSideEffect: true,
  noTaxAccountingSideEffect: true,
  noFileStorageSideEffect: true,
};

const initialObligations: ContractObligation[] = [
  {
    id: 'obligation-rejected-001',
    contractRecordId: 'contract-record-active',
    code: 'OBL-2026-000004',
    obligationType: 'DELIVERABLE',
    title: 'Rejected evidence correction',
    description: 'Rejected obligation ready to reopen for evidence correction.',
    status: 'REJECTED',
    evidencePolicy: 'REQUIRED',
    dueDate: now + day,
    periodStartDate: null,
    periodEndDate: null,
    responsibleOwnerEmploymentProfileId: 'employment-profile-without-display-000004',
    latestDeliveryNote: 'Initial delivery requires correction.',
    latestDeliveredAt: now - day,
    latestDeliveredBy: 'admin-user-002',
    latestEvidenceRefs: [],
    latestEventEvidenceLinkIds: [],
    latestReviewNote: null,
    latestReviewedAt: now - day / 2,
    latestReviewedBy: 'admin-user-003',
    latestRejectionReason: 'Evidence reference was incomplete.',
    statusTransitions: [
      {
        fromStatus: 'DELIVERED',
        toStatus: 'REJECTED',
        reason: 'Evidence reference was incomplete.',
        actorId: 'admin-user-003',
        happenedAt: now - day / 2,
      },
    ],
    boundaryMetadata: obligationBoundaryMetadata,
    createdAt: now - day * 5,
    updatedAt: now - day / 2,
  },
  {
    id: 'obligation-draft-001',
    contractRecordId: 'contract-record-active',
    code: 'OBL-2026-000001',
    obligationType: 'DELIVERABLE',
    title: 'Kịch bản nội dung',
    description: 'Bản nháp kịch bản chiến dịch cần mở trước khi giao nộp.',
    status: 'DRAFT',
    evidencePolicy: 'OPTIONAL',
    dueDate: now + day * 5,
    periodStartDate: null,
    periodEndDate: null,
    responsibleOwnerEmploymentProfileId: 'ep-002',
    latestDeliveryNote: null,
    latestDeliveredAt: null,
    latestDeliveredBy: null,
    latestEvidenceRefs: [],
    latestEventEvidenceLinkIds: [],
    latestReviewNote: null,
    latestReviewedAt: null,
    latestReviewedBy: null,
    latestRejectionReason: null,
    statusTransitions: [
      {
        fromStatus: null,
        toStatus: 'DRAFT',
        reason: 'Initial draft obligation',
        actorId: 'admin-user-001',
        happenedAt: now - day * 4,
      },
    ],
    boundaryMetadata: obligationBoundaryMetadata,
    createdAt: now - day * 4,
    updatedAt: now - day * 4,
  },
  {
    id: 'obligation-open-required',
    contractRecordId: 'contract-record-active',
    code: 'OBL-2026-000002',
    obligationType: 'SERVICE_MILESTONE',
    title: 'Nghiệm thu bằng chứng livestream',
    description: 'Nghĩa vụ yêu cầu bằng chứng từ Event đã hoàn tất hoặc tham chiếu trực tiếp.',
    status: 'OPEN',
    evidencePolicy: 'REQUIRED',
    dueDate: now + day * 2,
    periodStartDate: null,
    periodEndDate: null,
    responsibleOwnerEmploymentProfileId: 'ep-002',
    latestDeliveryNote: null,
    latestDeliveredAt: null,
    latestDeliveredBy: null,
    latestEvidenceRefs: [],
    latestEventEvidenceLinkIds: [],
    latestReviewNote: null,
    latestReviewedAt: null,
    latestReviewedBy: null,
    latestRejectionReason: null,
    statusTransitions: [
      {
        fromStatus: 'DRAFT',
        toStatus: 'OPEN',
        reason: 'Opened for delivery',
        actorId: 'admin-user-001',
        happenedAt: now - day,
      },
    ],
    boundaryMetadata: obligationBoundaryMetadata,
    createdAt: now - day * 3,
    updatedAt: now - day,
  },
  {
    id: 'obligation-delivered-001',
    contractRecordId: 'contract-record-active',
    code: 'OBL-2026-000003',
    obligationType: 'REPORTING',
    title: 'Báo cáo tổng kết chiến dịch',
    description: 'Đang chờ nghiệm thu rõ ràng.',
    status: 'DELIVERED',
    evidencePolicy: 'REQUIRED',
    dueDate: now - day,
    periodStartDate: null,
    periodEndDate: null,
    responsibleOwnerEmploymentProfileId: 'ep-002',
    latestDeliveryNote: 'Báo cáo đã gửi cho pháp lý rà soát.',
    latestDeliveredAt: now - day / 2,
    latestDeliveredBy: 'admin-user-002',
    latestEvidenceRefs: [
      {
        type: 'URL',
        label: 'Báo cáo tổng kết',
        url: 'https://example.test/campaign-report',
        referenceId: null,
      },
    ],
    latestEventEvidenceLinkIds: ['event-evidence-link-delivered-001'],
    latestReviewNote: null,
    latestReviewedAt: null,
    latestReviewedBy: null,
    latestRejectionReason: null,
    statusTransitions: [
      {
        fromStatus: 'OPEN',
        toStatus: 'DELIVERED',
        reason: 'Delivered with direct evidence',
        actorId: 'admin-user-002',
        happenedAt: now - day / 2,
      },
    ],
    boundaryMetadata: obligationBoundaryMetadata,
    createdAt: now - day * 6,
    updatedAt: now - day / 2,
  },
];

const eventSnapshotFixture = {
  eventId: 'event-completed-001',
  eventCode: 'EVT-2026-000001',
  eventTitle: 'Livestream ra mắt chiến dịch',
  eventStatus: 'COMPLETED' as const,
  eventUpdatedAt: now - day / 3,
  eventCompletedAt: now - day / 3,
  eventCompletedBy: 'admin-user-002',
  completionEvidenceNote: 'Ảnh chụp bằng chứng hoàn tất Event tại thời điểm liên kết.',
  completionEvidenceRefs: [
    {
      type: 'URL' as const,
      label: 'Biên bản hoàn tất Event',
      url: 'https://example.test/event-evidence',
      referenceId: null,
    },
  ],
};

const initialEventEvidenceLinks: ContractObligationEventEvidenceLink[] = [
  {
    id: 'event-evidence-link-delivered-001',
    obligationId: 'obligation-delivered-001',
    eventId: 'event-completed-delivered',
    status: 'ACTIVE',
    snapshot: {
      ...eventSnapshotFixture,
      eventId: 'event-completed-delivered',
      eventCode: 'EVT-2026-000055',
      eventTitle: 'Delivered obligation evidence Event',
    },
    linkReason: 'Selected as supporting evidence for delivery.',
    linkedAt: now - day,
    linkedBy: 'admin-user-002',
    removeReason: null,
    removedAt: null,
    removedBy: null,
    boundaryMetadata: {
      snapshotImmutable: true,
      activeLinkCanSatisfyDelivery: true,
      removedLinkCanSatisfyDelivery: false,
    },
    createdAt: now - day,
    updatedAt: now - day,
  },
  {
    id: 'event-evidence-link-active-001',
    obligationId: 'obligation-open-required',
    eventId: 'event-completed-001',
    status: 'ACTIVE',
    snapshot: eventSnapshotFixture,
    linkReason: 'Bằng chứng Event hoàn tất liên quan trực tiếp đến nghĩa vụ.',
    linkedAt: now - day / 4,
    linkedBy: 'admin-user-actor-000001',
    removeReason: null,
    removedAt: null,
    removedBy: null,
    boundaryMetadata: {
      snapshotImmutable: true,
      activeLinkCanSatisfyDelivery: true,
      removedLinkCanSatisfyDelivery: false,
    },
    createdAt: now - day / 4,
    updatedAt: now - day / 4,
  },
  {
    id: 'event-evidence-link-removed-001',
    obligationId: 'obligation-open-required',
    eventId: 'event-completed-removed',
    status: 'REMOVED',
    snapshot: {
      ...eventSnapshotFixture,
      eventId: 'event-completed-removed',
      eventCode: 'EVT-2026-000099',
      eventTitle: 'Event bằng chứng đã gỡ',
    },
    linkReason: 'Liên kết ban đầu để kiểm tra lịch sử.',
    linkedAt: now - day,
    linkedBy: 'admin-user-actor-000001',
    removeReason: 'Không còn phù hợp với nghĩa vụ này.',
    removedAt: now - day / 2,
    removedBy: 'admin-user-actor-000001',
    boundaryMetadata: {
      snapshotImmutable: true,
      activeLinkCanSatisfyDelivery: false,
      removedLinkCanSatisfyDelivery: false,
    },
    createdAt: now - day,
    updatedAt: now - day / 2,
  },
];

let obligationSeed = 3;
let eventEvidenceLinkSeed = 3;
let obligations = initialObligations.map((record) => ({
  ...record,
  latestEvidenceRefs: record.latestEvidenceRefs.map((ref) => ({ ...ref })),
  latestEventEvidenceLinkIds: [...record.latestEventEvidenceLinkIds],
  statusTransitions: record.statusTransitions.map((transition) => ({ ...transition })),
}));
let eventEvidenceLinks = initialEventEvidenceLinks.map((record) => ({
  ...record,
  snapshot: {
    ...record.snapshot,
    completionEvidenceRefs: record.snapshot.completionEvidenceRefs.map((ref) => ({ ...ref })),
  },
}));

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
  obligationSeed = 3;
  eventEvidenceLinkSeed = 2;
  obligations = initialObligations.map((record) => ({
    ...record,
    latestEvidenceRefs: record.latestEvidenceRefs.map((ref) => ({ ...ref })),
    latestEventEvidenceLinkIds: [...record.latestEventEvidenceLinkIds],
    statusTransitions: record.statusTransitions.map((transition) => ({ ...transition })),
  }));
  eventEvidenceLinks = initialEventEvidenceLinks.map((record) => ({
    ...record,
    snapshot: {
      ...record.snapshot,
      completionEvidenceRefs: record.snapshot.completionEvidenceRefs.map((ref) => ({ ...ref })),
    },
  }));
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

const toBoundaryMetadata = (contractKind: ContractKind): ContractBoundaryMetadata => {
  const commercialLegal = contractKind === 'TALENT_SERVICE' || contractKind === 'TALENT_MANAGEMENT';
  const legacyEmployment = contractKind === 'EMPLOYMENT';

  return {
    semanticBoundary: commercialLegal
      ? 'COMMERCIAL_LEGAL'
      : legacyEmployment
        ? 'LEGACY_EMPLOYMENT'
        : 'UNSUPPORTED',
    kindClassification: commercialLegal
      ? 'COMMERCIAL_LEGAL_SUPPORTED'
      : legacyEmployment
        ? 'LEGACY_EMPLOYMENT_DEPRECATED'
        : 'UNSUPPORTED_CONTRACT_KIND',
    commercialLegalRegistry: commercialLegal,
    commercialChainContextEligible: commercialLegal,
    directRevenueSourceEligible: false,
    directCommissionSourceEligible: false,
    payrollSourceEligible: false,
    obligationAcceptanceImplemented: commercialLegal,
    eventEvidenceLinkImplemented: commercialLegal,
  };
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
  boundaryMetadata: toBoundaryMetadata(record.contractKind),
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
  boundaryMetadata: toBoundaryMetadata(record.contractKind),
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
  boundaryMetadata: toBoundaryMetadata(record.contractKind),
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
  if (contractKind === 'EMPLOYMENT') {
    return linkedEntityKind === 'EMPLOYMENT_PROFILE';
  }

  return (
    (contractKind === 'TALENT_SERVICE' || contractKind === 'TALENT_MANAGEMENT') &&
    linkedEntityKind === 'TALENT'
  );
};

const findContract = (contractRecordId: string): ContractRecord | undefined =>
  contracts.find((record) => record.id === contractRecordId);

const findObligation = (obligationId: string): ContractObligation | undefined =>
  obligations.find((record) => record.id === obligationId);

const findEventEvidenceLink = (linkId: string): ContractObligationEventEvidenceLink | undefined =>
  eventEvidenceLinks.find((record) => record.id === linkId);

const isSupportedActiveContract = (record: ContractRecord): boolean =>
  record.status === 'ACTIVE' &&
  (record.contractKind === 'TALENT_SERVICE' || record.contractKind === 'TALENT_MANAGEMENT');

const rejectUnsupportedContractContext = (contractRecordId: string): Response | undefined => {
  const contract = findContract(contractRecordId);
  if (!contract) {
    return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
  }
  if (!isSupportedActiveContract(contract)) {
    return HttpResponse.json(
      { message: 'contract-registry:obligations.unavailable' },
      { status: 422 },
    );
  }
  return undefined;
};

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const toObligationDetail = (record: ContractObligation) => ({
  id: record.id,
  code: record.code,
  contractRecordId: record.contractRecordId,
  obligationType: record.obligationType,
  title: record.title,
  description: record.description,
  dueDate: record.dueDate,
  responsibleOwnerEmploymentProfileId: record.responsibleOwnerEmploymentProfileId,
  evidencePolicy: record.evidencePolicy,
  status: record.status,
  latestDeliveryNote: record.latestDeliveryNote,
  latestEvidenceRefs: record.latestEvidenceRefs.map((ref) => ({ ...ref })),
  latestEventEvidenceLinkIds: [...record.latestEventEvidenceLinkIds],
  latestDeliveredByActorId: record.latestDeliveredBy,
  latestDeliveredAt: record.latestDeliveredAt,
  latestReviewedByActorId: record.latestReviewedBy,
  latestReviewedAt: record.latestReviewedAt,
  acceptedByActorId: record.status === 'ACCEPTED' ? record.latestReviewedBy : null,
  acceptedAt: record.status === 'ACCEPTED' ? record.latestReviewedAt : null,
  rejectedByActorId: record.status === 'REJECTED' ? record.latestReviewedBy : null,
  rejectedAt: record.status === 'REJECTED' ? record.latestReviewedAt : null,
  rejectionReason: record.latestRejectionReason,
  statusHistory: record.statusTransitions.map((transition) => ({
    fromStatus: transition.fromStatus,
    toStatus: transition.toStatus,
    actorId: transition.actorId,
    occurredAt: transition.happenedAt,
    reason: transition.reason,
  })),
  createdByActorId: 'admin-user-001',
  createdAt: record.createdAt,
  updatedByActorId: 'admin-user-001',
  updatedAt: record.updatedAt,
  boundaryMetadata: {
    activeSupportedCommercialLegalContractRequired: true,
    legacyEmploymentContractAllowed: false,
    unsupportedContractKindAllowed: false,
    responsibleOwnerGrantsAuthority: false,
    eventEvidenceLinkImplemented: true,
    eventCompletionMutatesObligation: false,
    acceptanceCreatesRevenue: false,
    acceptanceCreatesCommission: false,
    acceptanceCreatesPayroll: false,
    acceptanceCreatesPayment: false,
    acceptanceCreatesTaxOrAccounting: false,
    fileStorageImplemented: false,
  },
});

const toEventEvidenceLinkDetail = (record: ContractObligationEventEvidenceLink) => {
  const obligation = findObligation(record.obligationId);
  return {
    id: record.id,
    contractObligationId: record.obligationId,
    contractRecordId: obligation?.contractRecordId ?? 'contract-record-active',
    eventId: record.eventId,
    status: record.status,
    linkedByActorId: record.linkedBy,
    linkedAt: record.linkedAt,
    linkReason: record.linkReason,
    removedByActorId: record.removedBy,
    removedAt: record.removedAt,
    removeReason: record.removeReason,
    snapshot: {
      eventId: record.snapshot.eventId,
      eventCode: record.snapshot.eventCode,
      eventTitle: record.snapshot.eventTitle,
      eventStatus: record.snapshot.eventStatus,
      eventUpdatedAt: record.snapshot.eventUpdatedAt,
      eventCompletedAt: record.snapshot.eventCompletedAt,
      eventCompletedByActorId: record.snapshot.eventCompletedBy,
      completionEvidenceNote: record.snapshot.completionEvidenceNote,
      completionEvidenceRefs: record.snapshot.completionEvidenceRefs.map((ref) => ({ ...ref })),
    },
    actionHistory: [
      {
        action: 'LINKED' as const,
        actorId: record.linkedBy,
        occurredAt: record.linkedAt,
        reason: record.linkReason,
      },
      ...(record.status === 'REMOVED' && record.removedAt && record.removeReason
        ? [
            {
              action: 'REMOVED' as const,
              actorId: record.removedBy ?? 'admin-user-001',
              occurredAt: record.removedAt,
              reason: record.removeReason,
            },
          ]
        : []),
    ],
    createdByActorId: record.linkedBy,
    createdAt: record.createdAt,
    updatedByActorId: record.removedBy ?? record.linkedBy,
    updatedAt: record.updatedAt,
    boundaryMetadata: {
      linkTarget: 'CONTRACT_OBLIGATION' as const,
      supportingEvidenceOnly: true as const,
      historicalSnapshot: true as const,
      linkMutatesEvent: false as const,
      linkMutatesObligationStatus: false as const,
      deliveryRemainsExplicit: true as const,
      acceptanceCreated: false as const,
      revenueCreated: false as const,
      commissionCreated: false as const,
      payrollCreated: false as const,
      paymentCreated: false as const,
      taxOrAccountingCreated: false as const,
      fileStorageCreated: false as const,
      inferredEventContractMatching: false as const,
    },
  };
};

const appendObligationTransition = (
  record: ContractObligation,
  toStatus: ContractObligationStatus,
  reason: string | null,
): void => {
  record.statusTransitions.push({
    fromStatus: record.status,
    toStatus,
    reason,
    actorId: 'admin-user-001',
    happenedAt: Date.now(),
  });
  record.status = toStatus;
  record.updatedAt = Date.now();
};

const parseEvidenceRefs = (value: unknown): ContractEvidenceRef[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): ContractEvidenceRef | undefined => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return undefined;
      }
      const entry = item as Record<string, unknown>;
      const type = entry.type as ContractEvidenceRefType;
      if (
        !['URL', 'PLATFORM_REFERENCE', 'EXTERNAL_REFERENCE', 'INTERNAL_REFERENCE'].includes(type)
      ) {
        return undefined;
      }
      const label = toNullableString(entry.label);
      if (!label) {
        return undefined;
      }
      return {
        type,
        label,
        url: type === 'URL' ? toNullableString(entry.url) : null,
        referenceId: type === 'URL' ? null : toNullableString(entry.referenceId),
      };
    })
    .filter((item): item is ContractEvidenceRef => Boolean(item));
};

const activeLinksForObligation = (obligationId: string): ContractObligationEventEvidenceLink[] =>
  eventEvidenceLinks.filter(
    (link) => link.obligationId === obligationId && link.status === 'ACTIVE',
  );

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
    if (contractKind !== 'TALENT_SERVICE' && contractKind !== 'TALENT_MANAGEMENT') {
      return HttpResponse.json(
        { message: 'contract-registry:validation.employmentCreateRejected' },
        { status: 422 },
      );
    }
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
  http.get('*/admin/contract-records/:contractRecordId/obligations', ({ params }) => {
    const unsupported = rejectUnsupportedContractContext(String(params.contractRecordId));
    if (unsupported) {
      return unsupported;
    }
    return HttpResponse.json({
      data: obligations
        .filter((record) => record.contractRecordId === String(params.contractRecordId))
        .map(toObligationDetail),
    });
  }),
  http.post(
    '*/admin/contract-records/:contractRecordId/obligations',
    async ({ params, request }) => {
      const contractRecordId = String(params.contractRecordId);
      const unsupported = rejectUnsupportedContractContext(contractRecordId);
      if (unsupported) {
        return unsupported;
      }
      const body = await parseJsonBody(request);
      const reasonFailure = rejectUnsupportedBody(
        body,
        new Set([
          'obligationType',
          'title',
          'description',
          'dueDate',
          'periodStartDate',
          'periodEndDate',
          'responsibleOwnerEmploymentProfileId',
          'evidencePolicy',
        ]),
      );
      if (reasonFailure) {
        return reasonFailure;
      }
      const title = toNullableString(body.title);
      const responsibleOwnerEmploymentProfileId = toNullableString(
        body.responsibleOwnerEmploymentProfileId,
      );
      const obligationType = body.obligationType as ContractObligationType;
      const evidencePolicy = body.evidencePolicy as ContractObligationEvidencePolicy;
      if (
        !title ||
        !responsibleOwnerEmploymentProfileId ||
        !['DELIVERABLE', 'SERVICE_MILESTONE', 'REPORTING', 'OTHER'].includes(obligationType) ||
        !['OPTIONAL', 'REQUIRED'].includes(evidencePolicy)
      ) {
        return HttpResponse.json(
          { message: 'contract-registry:validation.required' },
          { status: 422 },
        );
      }
      obligationSeed += 1;
      const createdAt = Date.now();
      const next: ContractObligation = {
        id: `obligation-${obligationSeed}`,
        contractRecordId,
        code: generatedFixtureYearCode('OBL', createdAt, obligationSeed),
        obligationType,
        title,
        description: toNullableString(body.description),
        status: 'DRAFT',
        evidencePolicy,
        dueDate:
          typeof body.dueDate === 'string' && body.dueDate
            ? inputDateToTimestamp(body.dueDate)
            : null,
        periodStartDate: null,
        periodEndDate: null,
        responsibleOwnerEmploymentProfileId,
        latestDeliveryNote: null,
        latestDeliveredAt: null,
        latestDeliveredBy: null,
        latestEvidenceRefs: [],
        latestEventEvidenceLinkIds: [],
        latestReviewNote: null,
        latestReviewedAt: null,
        latestReviewedBy: null,
        latestRejectionReason: null,
        statusTransitions: [
          {
            fromStatus: null,
            toStatus: 'DRAFT',
            reason: 'Created by admin',
            actorId: 'admin-user-001',
            happenedAt: createdAt,
          },
        ],
        boundaryMetadata: obligationBoundaryMetadata,
        createdAt,
        updatedAt: createdAt,
      };
      obligations.unshift(next);
      return HttpResponse.json({ data: toObligationDetail(next) });
    },
  ),
  http.get('*/admin/contract-records/obligations/:obligationId', ({ params }) => {
    const obligation = findObligation(String(params.obligationId));
    if (!obligation) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    return HttpResponse.json({ data: toObligationDetail(obligation) });
  }),
  http.patch('*/admin/contract-records/obligations/:obligationId', async ({ params, request }) => {
    const obligation = findObligation(String(params.obligationId));
    if (!obligation) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
    if (unsupported) {
      return unsupported;
    }
    if (obligation.status !== 'DRAFT' && obligation.status !== 'OPEN') {
      return rejectInvalidTransition();
    }
    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(
      body,
      new Set([
        'obligationType',
        'title',
        'description',
        'dueDate',
        'periodStartDate',
        'periodEndDate',
        'responsibleOwnerEmploymentProfileId',
        'evidencePolicy',
      ]),
    );
    if (bodyFailure) {
      return bodyFailure;
    }
    const title = toNullableString(body.title);
    const responsibleOwnerEmploymentProfileId = toNullableString(
      body.responsibleOwnerEmploymentProfileId,
    );
    if (!title || !responsibleOwnerEmploymentProfileId) {
      return HttpResponse.json(
        { message: 'contract-registry:validation.required' },
        { status: 422 },
      );
    }
    obligation.title = title;
    obligation.description = toNullableString(body.description);
    obligation.obligationType = body.obligationType as ContractObligationType;
    obligation.evidencePolicy = body.evidencePolicy as ContractObligationEvidencePolicy;
    obligation.dueDate =
      typeof body.dueDate === 'string' && body.dueDate ? inputDateToTimestamp(body.dueDate) : null;
    obligation.responsibleOwnerEmploymentProfileId = responsibleOwnerEmploymentProfileId;
    obligation.updatedAt = Date.now();
    return HttpResponse.json({ data: toObligationDetail(obligation) });
  }),
  http.post('*/admin/contract-records/obligations/:obligationId/open', async ({ params }) => {
    const obligation = findObligation(String(params.obligationId));
    if (!obligation) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
    if (unsupported) {
      return unsupported;
    }
    if (obligation.status !== 'DRAFT') {
      return rejectInvalidTransition();
    }
    appendObligationTransition(obligation, 'OPEN', 'Opened by admin');
    return HttpResponse.json({ data: toObligationDetail(obligation) });
  }),
  http.post(
    '*/admin/contract-records/obligations/:obligationId/reopen',
    async ({ params, request }) => {
      const obligation = findObligation(String(params.obligationId));
      if (!obligation) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
      if (unsupported) {
        return unsupported;
      }
      if (obligation.status !== 'REJECTED') {
        return rejectInvalidTransition();
      }
      const body = await parseJsonBody(request);
      const reason = toNullableString(body.reason);
      if (!reason || reason.length > 1_000) {
        return HttpResponse.json(
          { message: 'contract-registry:validation.required' },
          { status: 422 },
        );
      }
      appendObligationTransition(obligation, 'OPEN', reason);
      return HttpResponse.json({ data: toObligationDetail(obligation) });
    },
  ),
  http.post(
    '*/admin/contract-records/obligations/:obligationId/deliver',
    async ({ params, request }) => {
      const obligation = findObligation(String(params.obligationId));
      if (!obligation) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
      if (unsupported) {
        return unsupported;
      }
      if (obligation.status !== 'OPEN') {
        return rejectInvalidTransition();
      }
      const body = await parseJsonBody(request);
      const refs = parseEvidenceRefs(body.evidenceRefs);
      const selectedLinkIds = Array.isArray(body.eventEvidenceLinkIds)
        ? body.eventEvidenceLinkIds.filter((id): id is string => typeof id === 'string')
        : [];
      const validActiveIds = new Set(
        activeLinksForObligation(obligation.id).map((link) => link.id),
      );
      if (selectedLinkIds.some((id) => !validActiveIds.has(id))) {
        return HttpResponse.json({ message: 'errors:validation.conflict' }, { status: 409 });
      }
      if (
        obligation.evidencePolicy === 'REQUIRED' &&
        refs.length === 0 &&
        selectedLinkIds.length === 0
      ) {
        return HttpResponse.json(
          { message: 'contract-registry:obligations.validation.requiredEvidence' },
          { status: 422 },
        );
      }
      obligation.latestDeliveryNote = toNullableString(body.deliveryNote);
      obligation.latestDeliveredAt = Date.now();
      obligation.latestDeliveredBy = 'admin-user-001';
      obligation.latestEvidenceRefs = refs;
      obligation.latestEventEvidenceLinkIds = selectedLinkIds;
      appendObligationTransition(obligation, 'DELIVERED', 'Marked delivered by admin');
      return HttpResponse.json({ data: toObligationDetail(obligation) });
    },
  ),
  http.post(
    '*/admin/contract-records/obligations/:obligationId/accept',
    async ({ params, request }) => {
      const obligation = findObligation(String(params.obligationId));
      if (!obligation) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
      if (unsupported) {
        return unsupported;
      }
      if (obligation.status !== 'DELIVERED') {
        return rejectInvalidTransition();
      }
      const body = await parseJsonBody(request);
      obligation.latestReviewNote = toNullableString(body.reviewNote);
      obligation.latestReviewedAt = Date.now();
      obligation.latestReviewedBy = 'admin-user-001';
      appendObligationTransition(obligation, 'ACCEPTED', 'Accepted by admin');
      return HttpResponse.json({ data: toObligationDetail(obligation) });
    },
  ),
  http.post(
    '*/admin/contract-records/obligations/:obligationId/reject',
    async ({ params, request }) => {
      const obligation = findObligation(String(params.obligationId));
      if (!obligation) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
      if (unsupported) {
        return unsupported;
      }
      if (obligation.status !== 'DELIVERED') {
        return rejectInvalidTransition();
      }
      const body = await parseJsonBody(request);
      const reason = toNullableString(body.reason);
      if (!reason) {
        return HttpResponse.json(
          { message: 'contract-registry:validation.required' },
          { status: 422 },
        );
      }
      obligation.latestRejectionReason = reason;
      obligation.latestReviewedAt = Date.now();
      obligation.latestReviewedBy = 'admin-user-001';
      appendObligationTransition(obligation, 'REJECTED', reason);
      return HttpResponse.json({ data: toObligationDetail(obligation) });
    },
  ),
  http.post(
    '*/admin/contract-records/obligations/:obligationId/cancel',
    async ({ params, request }) => {
      const obligation = findObligation(String(params.obligationId));
      if (!obligation) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
      if (unsupported) {
        return unsupported;
      }
      if (obligation.status !== 'DRAFT' && obligation.status !== 'OPEN') {
        return rejectInvalidTransition();
      }
      const body = await parseJsonBody(request);
      const reason = toNullableString(body.reason);
      if (!reason) {
        return HttpResponse.json(
          { message: 'contract-registry:validation.required' },
          { status: 422 },
        );
      }
      appendObligationTransition(obligation, 'CANCELLED', reason);
      return HttpResponse.json({ data: toObligationDetail(obligation) });
    },
  ),
  http.post(
    '*/admin/contract-records/obligations/:obligationId/archive',
    async ({ params, request }) => {
      const obligation = findObligation(String(params.obligationId));
      if (!obligation) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
      if (unsupported) {
        return unsupported;
      }
      if (obligation.status !== 'ACCEPTED' && obligation.status !== 'CANCELLED') {
        return rejectInvalidTransition();
      }
      const body = await parseJsonBody(request);
      const reason = toNullableString(body.reason);
      appendObligationTransition(obligation, 'ARCHIVED', reason);
      return HttpResponse.json({ data: toObligationDetail(obligation) });
    },
  ),
  http.get(
    '*/admin/contract-records/obligations/:obligationId/event-evidence-links',
    ({ params }) => {
      const obligation = findObligation(String(params.obligationId));
      if (!obligation) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
      if (unsupported) {
        return unsupported;
      }
      return HttpResponse.json({
        data: eventEvidenceLinks
          .filter((link) => link.obligationId === obligation.id)
          .map(toEventEvidenceLinkDetail),
      });
    },
  ),
  http.post(
    '*/admin/contract-records/obligations/:obligationId/event-evidence-links',
    async ({ params, request }) => {
      const obligation = findObligation(String(params.obligationId));
      if (!obligation) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
      if (unsupported) {
        return unsupported;
      }
      if (obligation.status !== 'OPEN') {
        return rejectInvalidTransition();
      }
      const body = await parseJsonBody(request);
      const eventId = toNullableString(body.eventId);
      const linkReason = toNullableString(body.linkReason);
      if (!eventId || !linkReason || !eventId.startsWith('event-completed')) {
        return HttpResponse.json(
          { message: 'contract-registry:validation.required' },
          { status: 422 },
        );
      }
      if (
        eventEvidenceLinks.some(
          (link) =>
            link.obligationId === obligation.id &&
            link.eventId === eventId &&
            link.status === 'ACTIVE',
        )
      ) {
        return HttpResponse.json({ message: 'errors:validation.conflict' }, { status: 409 });
      }
      eventEvidenceLinkSeed += 1;
      const createdAt = Date.now();
      const next: ContractObligationEventEvidenceLink = {
        id: `event-evidence-link-${eventEvidenceLinkSeed}`,
        obligationId: obligation.id,
        eventId,
        status: 'ACTIVE',
        snapshot: {
          ...eventSnapshotFixture,
          eventId,
          eventCode: eventId === 'event-completed-001' ? 'EVT-2026-000001' : 'EVT-2026-000777',
        },
        linkReason,
        linkedAt: createdAt,
        linkedBy: 'admin-user-001',
        removeReason: null,
        removedAt: null,
        removedBy: null,
        boundaryMetadata: {
          snapshotImmutable: true,
          activeLinkCanSatisfyDelivery: true,
          removedLinkCanSatisfyDelivery: false,
        },
        createdAt,
        updatedAt: createdAt,
      };
      eventEvidenceLinks.unshift(next);
      return HttpResponse.json({ data: toEventEvidenceLinkDetail(next) });
    },
  ),
  http.post(
    '*/admin/contract-records/obligations/event-evidence-links/:linkId/remove',
    async ({ params, request }) => {
      const link = findEventEvidenceLink(String(params.linkId));
      if (!link) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const obligation = findObligation(link.obligationId);
      if (!obligation) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const unsupported = rejectUnsupportedContractContext(obligation.contractRecordId);
      if (unsupported) {
        return unsupported;
      }
      if (obligation.status !== 'OPEN' || link.status !== 'ACTIVE') {
        return rejectInvalidTransition();
      }
      const body = await parseJsonBody(request);
      const removeReason = toNullableString(body.removeReason);
      if (!removeReason) {
        return HttpResponse.json(
          { message: 'contract-registry:validation.required' },
          { status: 422 },
        );
      }
      link.status = 'REMOVED';
      link.removeReason = removeReason;
      link.removedAt = Date.now();
      link.removedBy = 'admin-user-001';
      link.boundaryMetadata = {
        snapshotImmutable: true,
        activeLinkCanSatisfyDelivery: false,
        removedLinkCanSatisfyDelivery: false,
      };
      link.updatedAt = Date.now();
      return HttpResponse.json({ data: toEventEvidenceLinkDetail(link) });
    },
  ),
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
      if (
        record &&
        record.contractKind !== 'TALENT_SERVICE' &&
        record.contractKind !== 'TALENT_MANAGEMENT'
      ) {
        return HttpResponse.json(
          { message: 'contract-registry:validation.legacyPromotionRejected' },
          { status: 422 },
        );
      }
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
    if (
      record &&
      record.contractKind !== 'TALENT_SERVICE' &&
      record.contractKind !== 'TALENT_MANAGEMENT'
    ) {
      return HttpResponse.json(
        { message: 'contract-registry:validation.legacyPromotionRejected' },
        { status: 422 },
      );
    }
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
