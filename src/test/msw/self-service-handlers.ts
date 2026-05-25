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
  locale?: string;
  timezone?: string;
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
  locale: 'en',
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

export const resetSelfServiceMockData = (): void => {
  selfServiceCurrentPerson = {
    ...defaultSelfServiceCurrentPerson,
    linkedInternalTalent: { ...defaultSelfServiceCurrentPerson.linkedInternalTalent! },
  };
  selfServiceWorkShifts = defaultSelfServiceWorkShifts.map((shift) => ({ ...shift }));
  selfServiceEvents = defaultSelfServiceEvents.map((event) => ({ ...event }));
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

export const selfServiceHandlers = [
  http.get('*/self-service/me', () => {
    return HttpResponse.json({
      data: selfServiceCurrentPerson,
    });
  }),
  http.get('*/self-service/work-shifts', () => {
    return HttpResponse.json({
      data: selfServiceWorkShifts,
    });
  }),
  http.get('*/self-service/events', () => {
    return HttpResponse.json({
      data: selfServiceEvents,
    });
  }),
];
