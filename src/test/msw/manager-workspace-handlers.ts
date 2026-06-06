import { http, HttpResponse } from 'msw';

import type {
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
      reason: 'NOT_ENABLED_IN_MANAGER_WORKSPACE_YET',
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

let managerWorkspaceContext = managerWorkspaceDualContext();
let managerWorkShifts = defaultManagerWorkShifts();
let managerRequestBatchSeed = 1;
let managerRequestBatches: ManagerRequestBatchDetail[] = [];

const managerBatchToListItem = (batch: ManagerRequestBatchDetail): ManagerRequestBatchListItem => {
  const item: Partial<ManagerRequestBatchDetail> = { ...batch };
  delete item.lines;
  return item as ManagerRequestBatchListItem;
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
    counts.pending === 0 ? (counts.approved > 0 && counts.approved < counts.total ? 'PARTIALLY_APPROVED' : undefined) : undefined;
  return {
    ...batch,
    lineCounts: counts,
    status:
      counts.pending > 0
        ? batch.status
        : resolved ?? (counts.cancelled === counts.total ? 'CANCELLED' : batch.status),
    updatedAt: Date.now(),
  } satisfies ManagerRequestBatchDetail;
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

export const resetManagerWorkspaceMockData = (): void => {
  managerWorkspaceContext = managerWorkspaceDualContext();
  managerWorkShifts = defaultManagerWorkShifts();
  managerRequestBatchSeed = 1;
  managerRequestBatches = seedManagerRequestBatches();
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
  http.get('*/admin/manager-workspace/work-schedule/work-shifts', () =>
    HttpResponse.json({ data: managerWorkShifts }),
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
          requestedStartAt: typeof line.requestedStartAt === 'number' ? line.requestedStartAt : null,
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
  http.post('*/admin/manager-workspace/work-schedule/request-batches/:batchId/cancel', async ({ params, request }) => {
    const body = (await request.json()) as { cancellationReason?: string };
    const batchIndex = managerRequestBatches.findIndex((item) => item.id === String(params.batchId));
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
          ? { ...line, status: 'CANCELLED', cancellationReason: body.cancellationReason ?? 'Cancelled by manager', cancelledAt: now, updatedAt: now }
          : line,
      ),
    });
    return HttpResponse.json({ data: managerRequestBatches[batchIndex] });
  }),
  http.post('*/admin/manager-workspace/work-schedule/request-batches/:batchId/lines/:lineId/cancel', async ({ params, request }) => {
    const body = (await request.json()) as { cancellationReason?: string };
    const batchIndex = managerRequestBatches.findIndex((item) => item.id === String(params.batchId));
    if (batchIndex < 0) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    const now = Date.now();
    const batch = managerRequestBatches[batchIndex];
    managerRequestBatches[batchIndex] = recalculateLineCounts({
      ...batch,
      lines: batch.lines.map((line) =>
        line.id === String(params.lineId) && line.status === 'PENDING'
          ? { ...line, status: 'CANCELLED', cancellationReason: body.cancellationReason ?? 'Cancelled by manager', cancelledAt: now, updatedAt: now }
          : line,
      ),
    });
    return HttpResponse.json({ data: managerRequestBatches[batchIndex] });
  }),
];
