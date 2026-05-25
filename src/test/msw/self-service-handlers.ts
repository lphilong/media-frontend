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

let selfServiceCurrentPerson: SelfServiceCurrentPerson = {
  ...defaultSelfServiceCurrentPerson,
  linkedInternalTalent: { ...defaultSelfServiceCurrentPerson.linkedInternalTalent! },
};
let selfServiceWorkShifts: SelfServiceWorkShift[] = defaultSelfServiceWorkShifts.map((shift) => ({
  ...shift,
}));

export const resetSelfServiceMockData = (): void => {
  selfServiceCurrentPerson = {
    ...defaultSelfServiceCurrentPerson,
    linkedInternalTalent: { ...defaultSelfServiceCurrentPerson.linkedInternalTalent! },
  };
  selfServiceWorkShifts = defaultSelfServiceWorkShifts.map((shift) => ({ ...shift }));
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
];
