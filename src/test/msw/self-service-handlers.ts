import { http, HttpResponse } from 'msw';

type SelfServiceCurrentPerson = {
  employmentProfileId: string;
  employeeCode: string;
  displayName: string;
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'ARCHIVED';
  accountEmail?: string;
  accountStatus?: 'PENDING' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  accountLinkStatus: 'LINKED';
  linkedInternalTalent?: {
    talentId: string;
    talentCode: string;
    displayName: string;
    performanceAlias: string | null;
  };
  locale?: string | null;
  timezone?: string | null;
};

type SelfServiceWorkShift = {
  workShiftId: string;
  title: string;
  status: 'ACTIVE' | 'CANCELLED' | 'ARCHIVED';
  startsAt: number;
  endsAt: number;
  sourceType: 'MANUAL' | 'ROSTER_GENERATED';
};

type SelfServiceEvent = {
  eventId: string;
  eventCode: string;
  title: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  startsAt: number;
  endsAt: number;
  ownAssignmentKind: 'EMPLOYMENT_PROFILE' | 'TALENT';
  ownAssignmentStatus: 'ACTIVE' | 'REMOVED';
};

type SelfServiceKpiItem = {
  kpiPlanId: string;
  title: string;
  periodMonth: string;
  periodStartAt: number;
  periodEndAt: number;
  officialStatus: 'OFFICIAL_PUBLISHED';
  lastUpdatedAt: number;
  metrics: Array<{
    metricCode:
      | 'REVENUE_VND'
      | 'CONTENT_OUTPUT_COUNT'
      | 'LIVE_HOURS'
      | 'EVENT_COMPLETION_COUNT'
      | 'ONBOARDED_TALENT_COUNT';
    unit: 'VND' | 'COUNT' | 'HOUR';
    targetValue: number;
    actualValue: number;
    progressPercent: number | null;
  }>;
};

type SelfServiceTalentGroup = {
  talentGroupCode: string;
  name: string;
  status?: 'ACTIVE';
  managers: Array<{
    displayName: string;
    employeeCode?: string;
  }>;
  members: Array<{
    talentCode: string;
    displayName: string;
    performanceAlias?: string;
    origin: 'INTERNAL' | 'EXTERNAL';
  }>;
};

const allowedPreferenceFields = new Set(['locale', 'timezone']);
const supportedPreferenceLocales = new Set(['en', 'vi', 'zh']);

const defaultSelfServiceCurrentPerson: SelfServiceCurrentPerson = {
  employmentProfileId: 'ep-self',
  employeeCode: 'EP-SELF-001',
  displayName: 'Mina Staff',
  employmentStatus: 'ACTIVE',
  accountEmail: 'mina.staff@example.test',
  accountStatus: 'ACTIVE',
  accountLinkStatus: 'LINKED',
  linkedInternalTalent: {
    talentId: 'talent-self',
    talentCode: 'TAL-SELF-001',
    displayName: 'Mina Staff',
    performanceAlias: 'Creator Mina',
  },
  locale: null,
  timezone: 'Asia/Saigon',
};

const defaultSelfServiceWorkShifts: SelfServiceWorkShift[] = [
  {
    workShiftId: 'shift-self-001',
    title: 'Studio filming shift',
    status: 'ACTIVE',
    startsAt: Date.UTC(2026, 4, 26, 2, 0),
    endsAt: Date.UTC(2026, 4, 26, 6, 0),
    sourceType: 'ROSTER_GENERATED',
  },
  {
    workShiftId: 'shift-self-002',
    title: 'Content review shift',
    status: 'CANCELLED',
    startsAt: Date.UTC(2026, 4, 27, 3, 0),
    endsAt: Date.UTC(2026, 4, 27, 5, 0),
    sourceType: 'MANUAL',
  },
];

const selfServiceEventsFixtureSource = {
  returned: [
    {
      eventId: 'event-self-talent',
      eventCode: 'EVT-SELF-TAL',
      title: 'Creator livestream event',
      status: 'SCHEDULED',
      startsAt: Date.UTC(2026, 4, 28, 2, 0),
      endsAt: Date.UTC(2026, 4, 28, 4, 0),
      ownAssignmentKind: 'TALENT',
      ownAssignmentStatus: 'ACTIVE',
      description: 'Internal production note with full roster and client budget',
      externalRef: 'externalRef-secret',
      platformAccountIds: ['platform-secret-account'],
      participantRoster: ['Other Staff'],
      managerOnlyNote: 'manager only note',
    },
    {
      eventId: 'event-self-employment-profile',
      eventCode: 'EVT-SELF-EP',
      title: 'Studio briefing event',
      status: 'IN_PROGRESS',
      startsAt: Date.UTC(2026, 4, 29, 3, 0),
      endsAt: Date.UTC(2026, 4, 29, 5, 0),
      ownAssignmentKind: 'EMPLOYMENT_PROFILE',
      ownAssignmentStatus: 'ACTIVE',
      studioResourceIds: ['private-studio-room'],
      commercialTerms: 'commercial confidential',
    },
  ],
  excluded: [
    {
      eventId: 'event-unrelated',
      eventCode: 'EVT-OTHER',
      title: 'Other staff event',
      reason: 'unrelated assignment',
    },
    {
      eventId: 'event-group',
      eventCode: 'EVT-GROUP',
      title: 'TalentGroup-only event',
      reason: 'group assignment only',
    },
    {
      eventId: 'event-external',
      eventCode: 'EVT-EXT',
      title: 'External Talent event',
      reason: 'external talent assignment',
    },
    {
      eventId: 'event-removed',
      eventCode: 'EVT-REMOVED',
      title: 'Removed assignment event',
      reason: 'removed assignment',
    },
  ],
} as const;

const defaultSelfServiceEvents: SelfServiceEvent[] = selfServiceEventsFixtureSource.returned.map(
  (event) => ({
    eventId: event.eventId,
    eventCode: event.eventCode,
    title: event.title,
    status: event.status,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    ownAssignmentKind: event.ownAssignmentKind,
    ownAssignmentStatus: event.ownAssignmentStatus,
  }),
);

const selfServiceKpiFixtureSource = {
  returned: [
    {
      kpiPlanId: 'kpi-plan-self-published',
      title: 'May creator KPI',
      periodMonth: '2026-05',
      periodStartAt: Date.UTC(2026, 4, 1, -7, 0),
      periodEndAt: Date.UTC(2026, 5, 1, -7, 0) - 1,
      officialStatus: 'OFFICIAL_PUBLISHED',
      lastUpdatedAt: Date.UTC(2026, 4, 20, 4, 0),
      metrics: [
        {
          metricCode: 'REVENUE_VND',
          unit: 'VND',
          targetValue: 10000000,
          actualValue: 4500000,
          progressPercent: 45,
        },
        {
          metricCode: 'LIVE_HOURS',
          unit: 'HOUR',
          targetValue: 40,
          actualValue: 12.5,
          progressPercent: 31.25,
        },
      ],
      managerNote: 'manager note hidden from self-service',
      approvalNote: 'approval note hidden from self-service',
      submittedByActorId: 'manager-user',
      approvedByActorId: 'admin-user',
      publishedByActorId: 'admin-user',
      payrollBonusCommissionFinanceCommercial: 'payroll bonus commission finance commercial',
      groupTotal: 999999,
      otherMemberDisplayName: 'Other Staff',
    },
  ],
  excluded: [
    { title: 'Own DRAFT KPI allocation', allocationStatus: 'DRAFT' },
    { title: 'Own pending KPI allocation', allocationStatus: 'PENDING_APPROVAL' },
    { title: 'Own approved KPI allocation', allocationStatus: 'APPROVED' },
    { title: 'Own rejected KPI allocation', allocationStatus: 'REJECTED' },
    { title: 'Own legacy active KPI allocation', allocationStatus: 'ACTIVE' },
    { title: 'Other member published KPI allocation', allocationStatus: 'PUBLISHED' },
  ],
} as const;

const defaultSelfServiceKpi: SelfServiceKpiItem[] = selfServiceKpiFixtureSource.returned.map(
  (item) => ({
    kpiPlanId: item.kpiPlanId,
    title: item.title,
    periodMonth: item.periodMonth,
    periodStartAt: item.periodStartAt,
    periodEndAt: item.periodEndAt,
    officialStatus: item.officialStatus,
    lastUpdatedAt: item.lastUpdatedAt,
    metrics: item.metrics.map((metric) => ({ ...metric })),
  }),
);

const defaultSelfServiceTalentGroups: SelfServiceTalentGroup[] = [
  {
    talentGroupCode: 'TG-SELF-001',
    name: 'Creator Team',
    status: 'ACTIVE',
    managers: [
      {
        displayName: 'Mai Manager',
        employeeCode: 'EP-MGR-001',
      },
    ],
    members: [
      {
        talentCode: 'TAL-SELF-001',
        displayName: 'Mina Staff',
        performanceAlias: 'Creator Mina',
        origin: 'INTERNAL',
      },
      {
        talentCode: 'EXT-SELF-001',
        displayName: 'External Guest',
        performanceAlias: 'Guest Alias',
        origin: 'EXTERNAL',
      },
    ],
  },
];

let selfServiceCurrentPerson: SelfServiceCurrentPerson = {
  ...defaultSelfServiceCurrentPerson,
  linkedInternalTalent: { ...defaultSelfServiceCurrentPerson.linkedInternalTalent! },
};
let selfServiceWorkShifts: SelfServiceWorkShift[] = defaultSelfServiceWorkShifts.map((shift) => ({
  ...shift,
}));
let selfServiceEvents: SelfServiceEvent[] = defaultSelfServiceEvents.map((event) => ({
  ...event,
}));
let selfServiceKpi: SelfServiceKpiItem[] = defaultSelfServiceKpi.map((item) => ({
  ...item,
  metrics: item.metrics.map((metric) => ({ ...metric })),
}));
let selfServiceTalentGroups: SelfServiceTalentGroup[] = defaultSelfServiceTalentGroups.map(
  (group) => ({
    ...group,
    managers: group.managers.map((manager) => ({ ...manager })),
    members: group.members.map((member) => ({ ...member })),
  }),
);

export const resetSelfServiceMockData = (): void => {
  selfServiceCurrentPerson = {
    ...defaultSelfServiceCurrentPerson,
    linkedInternalTalent: { ...defaultSelfServiceCurrentPerson.linkedInternalTalent! },
  };
  selfServiceWorkShifts = defaultSelfServiceWorkShifts.map((shift) => ({ ...shift }));
  selfServiceEvents = defaultSelfServiceEvents.map((event) => ({ ...event }));
  selfServiceKpi = defaultSelfServiceKpi.map((item) => ({
    ...item,
    metrics: item.metrics.map((metric) => ({ ...metric })),
  }));
  selfServiceTalentGroups = defaultSelfServiceTalentGroups.map((group) => ({
    ...group,
    managers: group.managers.map((manager) => ({ ...manager })),
    members: group.members.map((member) => ({ ...member })),
  }));
};

export const setMockSelfServiceCurrentPerson = (value: SelfServiceCurrentPerson): void => {
  selfServiceCurrentPerson = {
    ...value,
    linkedInternalTalent: value.linkedInternalTalent
      ? { ...value.linkedInternalTalent }
      : undefined,
  };
};

export const setMockSelfServiceWorkShifts = (value: SelfServiceWorkShift[]): void => {
  selfServiceWorkShifts = value.map((shift) => ({ ...shift }));
};

export const setMockSelfServiceEvents = (value: SelfServiceEvent[]): void => {
  selfServiceEvents = value.map((event) => ({ ...event }));
};

export const setMockSelfServiceKpi = (value: SelfServiceKpiItem[]): void => {
  selfServiceKpi = value.map((item) => ({
    ...item,
    metrics: item.metrics.map((metric) => ({ ...metric })),
  }));
};

export const setMockSelfServiceTalentGroups = (value: SelfServiceTalentGroup[]): void => {
  selfServiceTalentGroups = value.map((group) => ({
    ...group,
    managers: group.managers.map((manager) => ({ ...manager })),
    members: group.members.map((member) => ({ ...member })),
  }));
};

export const selfServiceHandlers = [
  http.get('*/self-service/me', () => {
    return HttpResponse.json({
      data: selfServiceCurrentPerson,
    });
  }),
  http.patch('*/self-service/account/preferences', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const unsupportedFields = Object.keys(body).filter(
      (field) => !allowedPreferenceFields.has(field),
    );

    if (
      unsupportedFields.length > 0 ||
      (body.locale !== undefined &&
        (typeof body.locale !== 'string' || !supportedPreferenceLocales.has(body.locale))) ||
      (body.timezone !== undefined && (typeof body.timezone !== 'string' || !body.timezone.trim()))
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'SELF_SERVICE_VALIDATION_ERROR',
            message: 'Invalid self-service request',
          },
        },
        { status: 400 },
      );
    }

    selfServiceCurrentPerson = {
      ...selfServiceCurrentPerson,
      locale: typeof body.locale === 'string' ? body.locale : selfServiceCurrentPerson.locale,
      timezone:
        typeof body.timezone === 'string' ? body.timezone : selfServiceCurrentPerson.timezone,
    };

    return HttpResponse.json({
      data: selfServiceCurrentPerson,
    });
  }),
  http.get('*/self-service/work-shifts', ({ request }) => {
    const cursor = new URL(request.url).searchParams.get('cursor');

    return HttpResponse.json({
      data: cursor ? [] : selfServiceWorkShifts,
    });
  }),
  http.get('*/self-service/events', () => {
    return HttpResponse.json({
      data: selfServiceEvents,
      meta: {
        window: {
          recentPastDays: 30,
          upcomingDays: 90,
          windowStartAt: Date.UTC(2026, 3, 26, 0, 0),
          windowEndAt: Date.UTC(2026, 7, 24, 0, 0),
        },
        limit: 50,
        truncated: false,
      },
    });
  }),
  http.get('*/self-service/kpi', () => {
    return HttpResponse.json({
      data: {
        items: selfServiceKpi,
      },
    });
  }),
  http.get('*/self-service/talent-groups', () => {
    return HttpResponse.json({
      data: {
        items: selfServiceTalentGroups,
        meta: {
          groupsTruncated: false,
          maxGroups: 10,
        },
      },
    });
  }),
];
