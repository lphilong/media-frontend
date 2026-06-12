import { http, HttpResponse } from 'msw';

import type {
  ManagerAvailabilityBatchDetail,
  ManagerAvailabilityBatchListItem,
  ManagerAvailabilityTargetMembers,
  ManagerEventSummary,
  ManagerRequestBatchDetail,
  ManagerRequestBatchListItem,
  ManagerWorkspaceContext,
  ManagerWorkShiftList,
} from '@modules/manager-workspace/api/manager-workspace.api';

const kpiCapabilities = {
  read: true,
  manageAllocation: false,
  enterActual: false,
  correctActual: false,
  finalize: false,
} as const;

const baseContext = (): ManagerWorkspaceContext => ({
  actor: {
    id: 'user-manager',
    displayName: 'Mina Manager',
  },
  employmentProfile: {
    id: 'ep-manager',
    displayName: 'Mina Manager',
    employeeCode: 'EP-MGR-001',
    employmentStatus: 'ACTIVE',
    orgUnitId: 'ou-home',
  },
  readiness: {
    canUseManagerWorkspace: true,
    reasons: [],
  },
  scopes: {
    orgUnits: [],
    talentGroups: [],
  },
  modules: {
    kpi: {
      visible: false,
      unitKpiVisible: false,
      talentGroupKpiVisible: false,
    },
    workShifts: {
      visible: false,
      reason: 'NO_MANAGED_SCOPE_ASSIGNED',
    },
    events: {
      visible: false,
      reason: 'NO_MANAGED_SCOPE_ASSIGNED',
    },
    members: {
      visible: false,
      reason: 'NOT_ENABLED_IN_MANAGER_WORKSPACE_YET',
    },
  },
});

export const managerWorkspaceNoProfileContext = (): ManagerWorkspaceContext => ({
  ...baseContext(),
  employmentProfile: null,
  readiness: {
    canUseManagerWorkspace: false,
    reasons: ['NO_LINKED_EMPLOYMENT_PROFILE'],
  },
});

export const managerWorkspaceNoAssignmentsContext = (): ManagerWorkspaceContext => ({
  ...baseContext(),
  readiness: {
    canUseManagerWorkspace: true,
    reasons: ['NO_MANAGED_SCOPE_ASSIGNED'],
  },
});

export const managerWorkspaceOrgUnitOnlyContext = (): ManagerWorkspaceContext => ({
  ...baseContext(),
  scopes: {
    orgUnits: [
      {
        orgUnitId: 'org-unit-001',
        code: 'OU-PROD',
        name: 'Production Unit',
        role: 'UNIT_MANAGER',
        includeDescendants: false,
        capabilities: {
          kpi: {
            ...kpiCapabilities,
            manageAllocation: true,
            enterActual: true,
            correctActual: true,
          },
        },
      },
    ],
    talentGroups: [],
  },
  modules: {
    ...baseContext().modules,
    kpi: {
      visible: true,
      unitKpiVisible: true,
      talentGroupKpiVisible: false,
    },
    events: {
      visible: true,
    },
  },
});

export const managerWorkspaceOrgUnitDepartmentOwnerContext = (): ManagerWorkspaceContext => ({
  ...managerWorkspaceOrgUnitOnlyContext(),
  scopes: {
    orgUnits: managerWorkspaceOrgUnitOnlyContext().scopes.orgUnits.map((scope) => ({
      ...scope,
      role: 'DEPARTMENT_OWNER',
      capabilities: {
        kpi: {
          ...scope.capabilities.kpi,
          manageAllocation: false,
          enterActual: false,
          correctActual: false,
        },
      },
    })),
    talentGroups: [],
  },
});

export const managerWorkspaceOrgUnitOperatorContext = (): ManagerWorkspaceContext => ({
  ...managerWorkspaceOrgUnitOnlyContext(),
  scopes: {
    orgUnits: managerWorkspaceOrgUnitOnlyContext().scopes.orgUnits.map((scope) => ({
      ...scope,
      role: 'UNIT_OPERATOR',
      capabilities: {
        kpi: {
          ...scope.capabilities.kpi,
          manageAllocation: false,
          enterActual: false,
          correctActual: false,
        },
      },
    })),
    talentGroups: [],
  },
});

export const managerWorkspaceOrgUnitNoKpiCapabilityContext = (): ManagerWorkspaceContext => ({
  ...managerWorkspaceOrgUnitOnlyContext(),
  scopes: {
    orgUnits: managerWorkspaceOrgUnitOnlyContext().scopes.orgUnits.map((scope) => ({
      ...scope,
      capabilities: {
        kpi: kpiCapabilities,
      },
    })),
    talentGroups: [],
  },
  modules: {
    ...baseContext().modules,
    kpi: {
      visible: false,
      unitKpiVisible: false,
      talentGroupKpiVisible: false,
    },
    events: {
      visible: true,
    },
  },
  readiness: {
    canUseManagerWorkspace: true,
    reasons: ['MISSING_KPI_MANAGER_CAPABILITY'],
  },
});

export const managerWorkspaceTalentGroupOnlyContext = (): ManagerWorkspaceContext => ({
  ...baseContext(),
  scopes: {
    orgUnits: [],
    talentGroups: [
      {
        talentGroupId: 'group-001',
        code: 'TG-LIVE',
        name: 'Live Talent',
        capabilities: {
          kpi: kpiCapabilities,
        },
      },
    ],
  },
  modules: {
    ...baseContext().modules,
    kpi: {
      visible: true,
      unitKpiVisible: false,
      talentGroupKpiVisible: true,
    },
    events: {
      visible: true,
    },
  },
});

export const managerWorkspaceDualContext = (): ManagerWorkspaceContext => {
  const orgUnit = managerWorkspaceOrgUnitOnlyContext();
  const talentGroup = managerWorkspaceTalentGroupOnlyContext();

  return {
    ...baseContext(),
    scopes: {
      orgUnits: orgUnit.scopes.orgUnits,
      talentGroups: talentGroup.scopes.talentGroups,
    },
    modules: {
      ...baseContext().modules,
      kpi: {
        visible: true,
        unitKpiVisible: true,
        talentGroupKpiVisible: true,
      },
      events: {
        visible: true,
      },
    },
  };
};

export const managerWorkspaceWorkEnabledContext = (): ManagerWorkspaceContext => {
  const context = managerWorkspaceDualContext();
  return {
    ...context,
    modules: {
      ...context.modules,
      workShifts: {
        visible: true,
      },
    },
  };
};

const defaultManagerWorkShifts = (): ManagerWorkShiftList => ({
  items: [
    {
      workShiftId: 'manager-shift-org',
      title: 'Production morning shift',
      status: 'ACTIVE',
      shiftStartAt: Date.parse('2026-06-08T09:00:00+07:00'),
      shiftEndAt: Date.parse('2026-06-08T17:00:00+07:00'),
      timezone: 'Asia/Ho_Chi_Minh',
      sourceType: 'MANUAL',
      sourceRosterMonth: null,
      member: {
        employmentProfileId: 'ep-org-member',
        displayName: 'Org Unit Member',
        employeeCode: 'EP-ORG-001',
      },
    },
    {
      workShiftId: 'manager-shift-group',
      title: 'Talent group roster shift',
      status: 'ACTIVE',
      shiftStartAt: Date.parse('2026-06-09T10:00:00+07:00'),
      shiftEndAt: Date.parse('2026-06-09T18:00:00+07:00'),
      timezone: 'Asia/Ho_Chi_Minh',
      sourceType: 'ROSTER_GENERATED',
      sourceRosterMonth: '2026-06',
      member: {
        employmentProfileId: 'ep-group-member',
        displayName: 'Talent Group Member',
        employeeCode: 'EP-TG-001',
      },
    },
  ],
  meta: {
    month: '2026-06',
    timezone: 'Asia/Ho_Chi_Minh',
    managedMemberCount: 2,
    representedMemberCount: 2,
    returnedShiftCount: 2,
  },
});

const defaultManagerAvailabilityTargets = (): ManagerAvailabilityTargetMembers[] => [
  {
    target: {
      targetType: 'ORG_UNIT',
      targetId: 'org-unit-001',
      targetMode: 'EXACT_ONLY',
      code: 'OU-PROD',
      name: 'Production Unit',
      displayName: 'Production Unit',
    },
    members: [
      {
        employmentProfileId: 'ep-content-1',
        displayName: 'Content Member One',
        employeeCode: 'EP-CONTENT-1',
      },
    ],
    totalMembers: 1,
  },
  {
    target: {
      targetType: 'TALENT_GROUP',
      targetId: 'group-001',
      targetMode: 'EXACT_ONLY',
      code: 'TG-CREATOR',
      name: 'Creator Group',
      displayName: 'Creator Group',
    },
    members: [
      {
        employmentProfileId: 'ep-creator-1',
        displayName: 'Creator Member One',
        employeeCode: 'EP-CREATOR-1',
      },
    ],
    totalMembers: 1,
  },
];

const defaultManagerEvents = (): ManagerEventSummary[] => [
  {
    id: 'manager-event-001',
    eventCode: 'EVT-202606-000101',
    title: 'Studio launch rehearsal',
    status: 'CONFIRMED',
    eventStartAt: Date.parse('2026-06-15T09:00:00+07:00'),
    eventEndAt: Date.parse('2026-06-15T12:00:00+07:00'),
    owner: {
      id: 'ep-owner-001',
      code: 'EP-OPS-001',
      displayName: 'Ops Owner',
      name: 'Ops Owner',
    },
    participants: [
      {
        id: 'ep-org-member',
        code: 'EP-ORG-001',
        displayName: 'Org Unit Member',
        name: 'Org Unit Member',
      },
    ],
    studioBookings: [
      {
        id: 'booking-manager-001',
        status: 'CONFIRMED',
        bookingStartAt: Date.parse('2026-06-15T08:30:00+07:00'),
        bookingEndAt: Date.parse('2026-06-15T12:30:00+07:00'),
        resource: {
          id: 'studio-001',
          code: 'ST-A',
          displayName: 'Studio A',
          name: 'Studio A',
        },
      },
    ],
  },
  {
    id: 'manager-event-002',
    eventCode: 'EVT-202606-000102',
    title: 'Creator group shoot',
    status: 'PLANNED',
    eventStartAt: Date.parse('2026-06-18T14:00:00+07:00'),
    eventEndAt: Date.parse('2026-06-18T16:00:00+07:00'),
    owner: {
      id: 'ep-owner-002',
      code: 'EP-OPS-002',
      displayName: 'Studio Coordinator',
      name: 'Studio Coordinator',
    },
    participants: [
      {
        id: 'ep-group-member',
        code: 'EP-TG-001',
        displayName: 'Talent Group Member',
        name: 'Talent Group Member',
      },
    ],
    studioBookings: [
      {
        id: 'booking-manager-002',
        status: 'HELD',
        bookingStartAt: Date.parse('2026-06-18T13:30:00+07:00'),
        bookingEndAt: Date.parse('2026-06-18T16:30:00+07:00'),
        resource: {
          id: 'studio-002',
          code: 'ST-B',
          displayName: 'Studio B',
          name: 'Studio B',
        },
      },
    ],
  },
];

let managerWorkspaceContext = managerWorkspaceDualContext();
let managerWorkShifts = defaultManagerWorkShifts();
let managerAvailabilityTargets = defaultManagerAvailabilityTargets();
let managerEvents = defaultManagerEvents();
let managerRequestBatchSeed = 1;
let managerRequestBatches: ManagerRequestBatchDetail[] = [];
let managerAvailabilityBatchSeed = 1;
let managerAvailabilityBatches: ManagerAvailabilityBatchDetail[] = [];

const managerBatchToListItem = (batch: ManagerRequestBatchDetail): ManagerRequestBatchListItem => {
  const item: Partial<ManagerRequestBatchDetail> = { ...batch };
  delete item.lines;
  return item as ManagerRequestBatchListItem;
};

const managerAvailabilityBatchToListItem = (
  batch: ManagerAvailabilityBatchDetail,
): ManagerAvailabilityBatchListItem => {
  const item: Partial<ManagerAvailabilityBatchDetail> = { ...batch };
  delete item.lines;
  return item as ManagerAvailabilityBatchListItem;
};

const recalculateLineCounts = (batch: ManagerRequestBatchDetail) => {
  const counts = {
    total: batch.lines.length,
    pending: batch.lines.filter((line) => line.status === 'PENDING').length,
    approved: batch.lines.filter((line) => line.status === 'APPROVED').length,
    rejected: batch.lines.filter((line) => line.status === 'REJECTED').length,
    cancelled: batch.lines.filter((line) => line.status === 'CANCELLED').length,
    failedToApply: batch.lines.filter((line) => line.status === 'FAILED_TO_APPLY').length,
  };
  const resolved =
    counts.pending === 0
      ? counts.approved > 0 && counts.approved < counts.total
        ? 'PARTIALLY_APPROVED'
        : undefined
      : undefined;
  return {
    ...batch,
    lineCounts: counts,
    status:
      counts.pending > 0
        ? batch.status
        : (resolved ?? (counts.cancelled === counts.total ? 'CANCELLED' : batch.status)),
    updatedAt: Date.now(),
  } satisfies ManagerRequestBatchDetail;
};

const recalculateAvailabilityLineCounts = (
  batch: ManagerAvailabilityBatchDetail,
): ManagerAvailabilityBatchDetail => {
  const pending = batch.lines.filter((line) => line.status === 'PENDING').length;
  const approved = batch.lines.filter((line) => line.status === 'APPROVED').length;
  const rejected = batch.lines.filter((line) => line.status === 'REJECTED').length;
  const cancelled = batch.lines.filter((line) => line.status === 'CANCELLED').length;
  return {
    ...batch,
    lineCounts: {
      total: batch.lines.length,
      pending,
      approved,
      rejected,
      cancelled,
    },
  };
};

const seedManagerRequestBatches = (): ManagerRequestBatchDetail[] => [
  {
    id: 'manager-batch-001',
    batchCode: 'WSB-202606-000001',
    status: 'PENDING',
    periodMonth: '2026-06',
    scopeSummary: 'MIXED',
    note: 'Manager request batch',
    lineCounts: { total: 2, pending: 2, approved: 0, rejected: 0, cancelled: 0, failedToApply: 0 },
    clientToken: 'manager-token-001',
    submittedAt: Date.parse('2026-06-06T09:00:00+07:00'),
    cancelledAt: null,
    resolvedAt: null,
    createdAt: Date.parse('2026-06-06T09:00:00+07:00'),
    updatedAt: Date.parse('2026-06-06T09:00:00+07:00'),
    lines: [
      {
        id: 'manager-line-create',
        lineNo: 1,
        requestType: 'CREATE_SHIFT',
        status: 'PENDING',
        member: {
          employmentProfileId: 'ep-org-member',
          displayName: 'Org Unit Member',
          employeeCode: 'EP-ORG-001',
        },
        workShiftId: null,
        workShiftRef: null,
        requestedStartAt: Date.parse('2026-06-12T09:00:00+07:00'),
        requestedEndAt: Date.parse('2026-06-12T17:00:00+07:00'),
        timezone: 'Asia/Ho_Chi_Minh',
        title: 'Extra production support',
        description: null,
        externalRef: null,
        reason: 'Need extra production support coverage.',
        approvalNote: null,
        rejectionReason: null,
        cancellationReason: null,
        failureReason: null,
        appliedWorkShiftId: null,
        appliedWorkShiftRef: null,
        createdAt: Date.parse('2026-06-06T09:00:00+07:00'),
        updatedAt: Date.parse('2026-06-06T09:00:00+07:00'),
        approvedAt: null,
        rejectedAt: null,
        cancelledAt: null,
        failedAt: null,
      },
      {
        id: 'manager-line-cancel',
        lineNo: 2,
        requestType: 'CANCEL_SHIFT',
        status: 'PENDING',
        member: {
          employmentProfileId: 'ep-group-member',
          displayName: 'Talent Group Member',
          employeeCode: 'EP-TG-001',
        },
        workShiftId: 'manager-shift-group',
        workShiftRef: { id: 'manager-shift-group', title: 'Talent group roster shift' },
        requestedStartAt: null,
        requestedEndAt: null,
        timezone: 'Asia/Ho_Chi_Minh',
        title: null,
        description: null,
        externalRef: null,
        reason: 'Production no longer needs this roster coverage.',
        approvalNote: null,
        rejectionReason: null,
        cancellationReason: null,
        failureReason: null,
        appliedWorkShiftId: null,
        appliedWorkShiftRef: null,
        createdAt: Date.parse('2026-06-06T09:00:00+07:00'),
        updatedAt: Date.parse('2026-06-06T09:00:00+07:00'),
        approvedAt: null,
        rejectedAt: null,
        cancelledAt: null,
        failedAt: null,
      },
    ],
  },
];

const seedManagerAvailabilityBatches = (): ManagerAvailabilityBatchDetail[] => {
  const now = Date.now();
  const firstMember = managerAvailabilityTargets[0].members[0];
  const secondMember = managerAvailabilityTargets[1].members[0];

  return [
    {
      id: 'manager-availability-batch-1',
      availabilityBatchCode: 'AVB-000001',
      status: 'PENDING',
      periodMonth: '2026-06',
      targetType: 'ORG_UNIT',
      targetMode: 'EXACT_ONLY',
      targetOrgUnitId: 'org-content',
      targetTalentGroupId: null,
      target: {
        id: 'org-content',
        code: 'CONTENT',
        name: 'Content Ops',
        displayName: 'Content Ops',
      },
      note: 'June roster planning',
      lineCounts: {
        total: 2,
        pending: 1,
        approved: 1,
        rejected: 0,
        cancelled: 0,
      },
      clientToken: 'manager-availability-token-1',
      submittedAt: now - 1000,
      cancelledAt: null,
      resolvedAt: null,
      createdAt: now - 1000,
      updatedAt: now - 1000,
      lines: [
        {
          id: 'manager-availability-line-1',
          batchId: 'manager-availability-batch-1',
          lineNo: 1,
          member: firstMember,
          availabilityType: 'UNAVAILABLE_FULL_DAY',
          taxonomyCode: 'AUTHORIZED_LEAVE',
          availabilityDate: '2026-06-12',
          dateRangeStart: '2026-06-12',
          dateRangeEnd: '2026-06-12',
          preferredStartLocalTime: null,
          preferredEndLocalTime: null,
          reason: 'Family appointment before roster publish',
          status: 'PENDING',
          applyStatus: 'NOT_APPLIED',
          policyEvaluationStatus: 'NOT_EVALUATED',
          appliedRosterId: null,
          appliedRosterExceptionId: null,
          appliedRosterExceptionIds: [],
          appliedAt: null,
          adminDecisionNote: null,
          rejectionReason: null,
          cancellationReason: null,
          createdAt: now - 1000,
          updatedAt: now - 1000,
          approvedAt: null,
          rejectedAt: null,
          cancelledAt: null,
        },
        {
          id: 'manager-availability-line-2',
          batchId: 'manager-availability-batch-1',
          lineNo: 2,
          member: secondMember,
          availabilityType: 'OTHER_AVAILABILITY_NOTE',
          taxonomyCode: 'OTHER',
          availabilityDate: '2026-06-18',
          dateRangeStart: '2026-06-18',
          dateRangeEnd: '2026-06-18',
          preferredStartLocalTime: null,
          preferredEndLocalTime: null,
          reason: 'Prefers lighter assignment due to training day',
          status: 'APPROVED',
          applyStatus: 'ADVISORY_ONLY',
          policyEvaluationStatus: 'NOT_EVALUATED',
          appliedRosterId: null,
          appliedRosterExceptionId: null,
          appliedRosterExceptionIds: [],
          appliedAt: null,
          adminDecisionNote: 'Advisory note accepted',
          rejectionReason: null,
          cancellationReason: null,
          createdAt: now - 900,
          updatedAt: now - 900,
          approvedAt: now - 800,
          rejectedAt: null,
          cancelledAt: null,
        },
      ],
    },
  ];
};

export const resetManagerWorkspaceMockData = (): void => {
  managerWorkspaceContext = managerWorkspaceDualContext();
  managerWorkShifts = defaultManagerWorkShifts();
  managerAvailabilityTargets = defaultManagerAvailabilityTargets();
  managerEvents = defaultManagerEvents();
  managerRequestBatchSeed = 1;
  managerRequestBatches = seedManagerRequestBatches();
  managerAvailabilityBatchSeed = 1;
  managerAvailabilityBatches = seedManagerAvailabilityBatches();
};

export const setMockManagerWorkShifts = (value: ManagerWorkShiftList): void => {
  managerWorkShifts = {
    items: value.items.map((item) => ({ ...item, member: { ...item.member } })),
    meta: { ...value.meta },
  };
};

export const setMockManagerWorkspaceContext = (context: ManagerWorkspaceContext): void => {
  managerWorkspaceContext = {
    ...context,
    scopes: {
      orgUnits: context.scopes.orgUnits.map((scope) => ({ ...scope })),
      talentGroups: context.scopes.talentGroups.map((scope) => ({ ...scope })),
    },
  };
};

resetManagerWorkspaceMockData();

export const managerWorkspaceHandlers = [
  http.get('*/admin/manager-workspace/context', () =>
    HttpResponse.json({ data: managerWorkspaceContext }),
  ),
  http.get('*/admin/manager-workspace/events', () => {
    if (!managerWorkspaceContext.modules.events.visible) {
      return HttpResponse.json(
        { message: 'manager-workspace:events.noScopeMessage' },
        { status: 403 },
      );
    }
    return HttpResponse.json({ data: { items: managerEvents } });
  }),
  http.get('*/admin/manager-workspace/events/:eventId', ({ params }) => {
    if (!managerWorkspaceContext.modules.events.visible) {
      return HttpResponse.json(
        { message: 'manager-workspace:events.noScopeMessage' },
        { status: 403 },
      );
    }
    const event = managerEvents.find((item) => item.id === params.eventId);
    if (!event) {
      return HttpResponse.json(
        { message: 'manager-workspace:events.notFoundMessage' },
        { status: 404 },
      );
    }
    return HttpResponse.json({ data: event });
  }),
  http.get('*/admin/manager-workspace/work-schedule/work-shifts', () =>
    HttpResponse.json({ data: managerWorkShifts }),
  ),
  http.get('*/admin/manager-workspace/work-schedule/availability-members', ({ request }) => {
    const url = new URL(request.url);
    const targetType = url.searchParams.get('targetType');
    const targetId = url.searchParams.get('targetId');
    if ((targetType !== 'ORG_UNIT' && targetType !== 'TALENT_GROUP') || !targetId) {
      return HttpResponse.json({ message: 'invalid target' }, { status: 422 });
    }
    const data = managerAvailabilityTargets.find(
      (target) => target.target.targetType === targetType && target.target.targetId === targetId,
    );
    if (!data) {
      return HttpResponse.json(
        { message: 'target has no eligible availability members' },
        { status: 422 },
      );
    }
    return HttpResponse.json({ data });
  }),
  http.get('*/admin/manager-workspace/work-schedule/availability-batches', ({ request }) => {
    const url = new URL(request.url);
    const periodMonth = url.searchParams.get('periodMonth');
    const status = url.searchParams.get('status');
    const items = managerAvailabilityBatches
      .filter((batch) => !periodMonth || batch.periodMonth === periodMonth)
      .filter((batch) => !status || batch.status === status)
      .map(managerAvailabilityBatchToListItem);
    return HttpResponse.json({ data: { items } });
  }),
  http.get(
    '*/admin/manager-workspace/work-schedule/availability-batches/:batchId',
    ({ params }) => {
      const batch = managerAvailabilityBatches.find((item) => item.id === String(params.batchId));
      if (!batch) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      return HttpResponse.json({ data: batch });
    },
  ),
  http.post('*/admin/manager-workspace/work-schedule/availability-batches', async ({ request }) => {
    const body = (await request.json()) as {
      periodMonth?: string;
      targetType?: 'ORG_UNIT' | 'TALENT_GROUP';
      targetMode?: 'EXACT_ONLY';
      targetOrgUnitId?: string | null;
      targetTalentGroupId?: string | null;
      clientToken?: string;
      note?: string | null;
      lines?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 50) {
      return HttpResponse.json({ message: 'lines must contain at most 50 lines' }, { status: 422 });
    }
    const missingReason = body.lines.some(
      (line) => typeof line.reason !== 'string' || line.reason.trim().length === 0,
    );
    if (missingReason) {
      return HttpResponse.json({ message: 'reason is required' }, { status: 422 });
    }
    const targetId =
      body.targetType === 'TALENT_GROUP' ? body.targetTalentGroupId : body.targetOrgUnitId;
    const availabilityTarget = managerAvailabilityTargets.find(
      (target) =>
        target.target.targetType === body.targetType && target.target.targetId === targetId,
    );
    const membersById = new Map(
      availabilityTarget?.members.map((member) => [member.employmentProfileId, member]) ?? [],
    );
    if (
      !availabilityTarget ||
      body.lines.some((line) => !membersById.has(String(line.memberEmploymentProfileId)))
    ) {
      return HttpResponse.json(
        { message: 'availability member is not eligible for the selected exact target' },
        { status: 422 },
      );
    }
    managerAvailabilityBatchSeed += 1;
    const now = Date.now();
    const batchId = `manager-availability-batch-${managerAvailabilityBatchSeed}`;
    const batch: ManagerAvailabilityBatchDetail = {
      id: batchId,
      availabilityBatchCode: `AVB-${String(managerAvailabilityBatchSeed).padStart(6, '0')}`,
      status: 'PENDING',
      periodMonth: body.periodMonth ?? '2026-06',
      targetType: body.targetType ?? 'ORG_UNIT',
      targetMode: 'EXACT_ONLY',
      targetOrgUnitId: body.targetOrgUnitId ?? 'org-content',
      targetTalentGroupId: body.targetTalentGroupId ?? null,
      target: {
        id: availabilityTarget.target.targetId,
        code: availabilityTarget.target.code,
        name: availabilityTarget.target.name,
        displayName: availabilityTarget.target.displayName,
      },
      note: body.note ?? null,
      lineCounts: {
        total: body.lines.length,
        pending: body.lines.length,
        approved: 0,
        rejected: 0,
        cancelled: 0,
      },
      clientToken: body.clientToken ?? `manager-availability-token-${managerAvailabilityBatchSeed}`,
      submittedAt: now,
      cancelledAt: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
      lines: body.lines.map((line, index) => {
        const memberId = String(line.memberEmploymentProfileId);
        const member = membersById.get(memberId)!;
        return {
          id: `${batchId}-line-${index + 1}`,
          batchId,
          lineNo: index + 1,
          member,
          availabilityType:
            line.availabilityType as ManagerAvailabilityBatchDetail['lines'][number]['availabilityType'],
          taxonomyCode:
            line.taxonomyCode as ManagerAvailabilityBatchDetail['lines'][number]['taxonomyCode'],
          availabilityDate:
            typeof line.availabilityDate === 'string' ? line.availabilityDate : null,
          dateRangeStart: typeof line.dateRangeStart === 'string' ? line.dateRangeStart : null,
          dateRangeEnd: typeof line.dateRangeEnd === 'string' ? line.dateRangeEnd : null,
          preferredStartLocalTime:
            typeof line.preferredStartLocalTime === 'string' ? line.preferredStartLocalTime : null,
          preferredEndLocalTime:
            typeof line.preferredEndLocalTime === 'string' ? line.preferredEndLocalTime : null,
          reason: String(line.reason),
          status: 'PENDING',
          applyStatus: 'NOT_APPLIED',
          policyEvaluationStatus: 'NOT_EVALUATED',
          appliedRosterId: null,
          appliedRosterExceptionId: null,
          appliedRosterExceptionIds: [],
          appliedAt: null,
          adminDecisionNote: null,
          rejectionReason: null,
          cancellationReason: null,
          createdAt: now,
          updatedAt: now,
          approvedAt: null,
          rejectedAt: null,
          cancelledAt: null,
        };
      }),
    };
    managerAvailabilityBatches.unshift(batch);
    return HttpResponse.json({ data: batch });
  }),
  http.post(
    '*/admin/manager-workspace/work-schedule/availability-batches/:batchId/cancel',
    async ({ params, request }) => {
      const body = (await request.json()) as { cancellationReason?: string };
      const batchIndex = managerAvailabilityBatches.findIndex(
        (item) => item.id === String(params.batchId),
      );
      if (batchIndex < 0) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const now = Date.now();
      const batch = managerAvailabilityBatches[batchIndex];
      managerAvailabilityBatches[batchIndex] = recalculateAvailabilityLineCounts({
        ...batch,
        status: 'CANCELLED',
        cancelledAt: now,
        lines: batch.lines.map((line) =>
          line.status === 'PENDING'
            ? {
                ...line,
                status: 'CANCELLED',
                cancellationReason: body.cancellationReason ?? 'Cancelled by manager',
                cancelledAt: now,
                updatedAt: now,
              }
            : line,
        ),
      });
      return HttpResponse.json({ data: managerAvailabilityBatches[batchIndex] });
    },
  ),
  http.post(
    '*/admin/manager-workspace/work-schedule/availability-batches/:batchId/lines/:lineId/cancel',
    async ({ params, request }) => {
      const body = (await request.json()) as { cancellationReason?: string };
      const batchIndex = managerAvailabilityBatches.findIndex(
        (item) => item.id === String(params.batchId),
      );
      if (batchIndex < 0) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const now = Date.now();
      const batch = managerAvailabilityBatches[batchIndex];
      managerAvailabilityBatches[batchIndex] = recalculateAvailabilityLineCounts({
        ...batch,
        lines: batch.lines.map((line) =>
          line.id === String(params.lineId) && line.status === 'PENDING'
            ? {
                ...line,
                status: 'CANCELLED',
                cancellationReason: body.cancellationReason ?? 'Cancelled by manager',
                cancelledAt: now,
                updatedAt: now,
              }
            : line,
        ),
      });
      return HttpResponse.json({ data: managerAvailabilityBatches[batchIndex] });
    },
  ),
  http.get('*/admin/manager-workspace/work-schedule/request-batches', ({ request }) => {
    const url = new URL(request.url);
    const periodMonth = url.searchParams.get('periodMonth');
    const status = url.searchParams.get('status');
    const items = managerRequestBatches
      .filter((batch) => !periodMonth || batch.periodMonth === periodMonth)
      .filter((batch) => !status || batch.status === status)
      .map(managerBatchToListItem);
    return HttpResponse.json({ data: { items } });
  }),
  http.get('*/admin/manager-workspace/work-schedule/request-batches/:batchId', ({ params }) => {
    const batch = managerRequestBatches.find((item) => item.id === String(params.batchId));
    if (!batch) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    return HttpResponse.json({ data: batch });
  }),
  http.post('*/admin/manager-workspace/work-schedule/request-batches', async ({ request }) => {
    const body = (await request.json()) as {
      periodMonth?: string;
      clientToken?: string;
      note?: string | null;
      lines?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 50) {
      return HttpResponse.json({ message: 'lines must contain at most 50 lines' }, { status: 422 });
    }
    const missingReason = body.lines.some(
      (line) => typeof line.reason !== 'string' || line.reason.trim().length < 10,
    );
    if (missingReason) {
      return HttpResponse.json({ message: 'reason must be 10-1000 characters' }, { status: 422 });
    }
    managerRequestBatchSeed += 1;
    const now = Date.now();
    const batch: ManagerRequestBatchDetail = {
      id: `manager-batch-${managerRequestBatchSeed}`,
      batchCode: `WSB-${String(managerRequestBatchSeed).padStart(6, '0')}`,
      status: 'PENDING',
      periodMonth: body.periodMonth ?? '2026-06',
      scopeSummary: 'MIXED',
      note: body.note ?? null,
      lineCounts: {
        total: body.lines.length,
        pending: body.lines.length,
        approved: 0,
        rejected: 0,
        cancelled: 0,
        failedToApply: 0,
      },
      clientToken: body.clientToken ?? `manager-token-${managerRequestBatchSeed}`,
      submittedAt: now,
      cancelledAt: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
      lines: body.lines.map((line, index) => {
        const memberId = String(line.memberEmploymentProfileId);
        const member =
          managerWorkShifts.items.find((shift) => shift.member.employmentProfileId === memberId)
            ?.member ?? managerWorkShifts.items[0].member;
        return {
          id: `manager-line-${managerRequestBatchSeed}-${index + 1}`,
          lineNo: index + 1,
          requestType: line.requestType as 'CREATE_SHIFT' | 'RESCHEDULE_SHIFT' | 'CANCEL_SHIFT',
          status: 'PENDING',
          member,
          workShiftId: typeof line.workShiftId === 'string' ? line.workShiftId : null,
          workShiftRef: null,
          requestedStartAt:
            typeof line.requestedStartAt === 'number' ? line.requestedStartAt : null,
          requestedEndAt: typeof line.requestedEndAt === 'number' ? line.requestedEndAt : null,
          timezone: 'Asia/Ho_Chi_Minh',
          title: typeof line.title === 'string' ? line.title : null,
          description: typeof line.description === 'string' ? line.description : null,
          externalRef: typeof line.externalRef === 'string' ? line.externalRef : null,
          reason: String(line.reason),
          approvalNote: null,
          rejectionReason: null,
          cancellationReason: null,
          failureReason: null,
          appliedWorkShiftId: null,
          appliedWorkShiftRef: null,
          createdAt: now,
          updatedAt: now,
          approvedAt: null,
          rejectedAt: null,
          cancelledAt: null,
          failedAt: null,
        };
      }),
    };
    managerRequestBatches.unshift(batch);
    return HttpResponse.json({ data: batch });
  }),
  http.post(
    '*/admin/manager-workspace/work-schedule/request-batches/:batchId/cancel',
    async ({ params, request }) => {
      const body = (await request.json()) as { cancellationReason?: string };
      const batchIndex = managerRequestBatches.findIndex(
        (item) => item.id === String(params.batchId),
      );
      if (batchIndex < 0) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const now = Date.now();
      const batch = managerRequestBatches[batchIndex];
      managerRequestBatches[batchIndex] = recalculateLineCounts({
        ...batch,
        status: 'CANCELLED',
        cancelledAt: now,
        lines: batch.lines.map((line) =>
          line.status === 'PENDING'
            ? {
                ...line,
                status: 'CANCELLED',
                cancellationReason: body.cancellationReason ?? 'Cancelled by manager',
                cancelledAt: now,
                updatedAt: now,
              }
            : line,
        ),
      });
      return HttpResponse.json({ data: managerRequestBatches[batchIndex] });
    },
  ),
  http.post(
    '*/admin/manager-workspace/work-schedule/request-batches/:batchId/lines/:lineId/cancel',
    async ({ params, request }) => {
      const body = (await request.json()) as { cancellationReason?: string };
      const batchIndex = managerRequestBatches.findIndex(
        (item) => item.id === String(params.batchId),
      );
      if (batchIndex < 0) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const now = Date.now();
      const batch = managerRequestBatches[batchIndex];
      managerRequestBatches[batchIndex] = recalculateLineCounts({
        ...batch,
        lines: batch.lines.map((line) =>
          line.id === String(params.lineId) && line.status === 'PENDING'
            ? {
                ...line,
                status: 'CANCELLED',
                cancellationReason: body.cancellationReason ?? 'Cancelled by manager',
                cancelledAt: now,
                updatedAt: now,
              }
            : line,
        ),
      });
      return HttpResponse.json({ data: managerRequestBatches[batchIndex] });
    },
  ),
];
