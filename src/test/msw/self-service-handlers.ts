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

let selfServiceCurrentPerson: SelfServiceCurrentPerson = {
  ...defaultSelfServiceCurrentPerson,
  linkedInternalTalent: { ...defaultSelfServiceCurrentPerson.linkedInternalTalent! },
};

export const resetSelfServiceMockData = (): void => {
  selfServiceCurrentPerson = {
    ...defaultSelfServiceCurrentPerson,
    linkedInternalTalent: { ...defaultSelfServiceCurrentPerson.linkedInternalTalent! },
  };
};

export const setMockSelfServiceCurrentPerson = (value: SelfServiceCurrentPerson): void => {
  selfServiceCurrentPerson = {
    ...value,
    linkedInternalTalent: value.linkedInternalTalent
      ? { ...value.linkedInternalTalent }
      : undefined,
  };
};

export const selfServiceHandlers = [
  http.get('*/self-service/me', () => {
    return HttpResponse.json({
      data: selfServiceCurrentPerson,
    });
  }),
];
