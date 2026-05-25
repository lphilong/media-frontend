const joinDetailPath = (basePath: string, entityId: string): string =>
  `${basePath}/${encodeURIComponent(entityId)}`;

export const APP_PATHS = {
  root: '/',
  dashboard: '/dashboard',
  selfService: '/self-service',

  users: '/users',
  userDetailPattern: '/users/:userId',
  userDetail: (userId: string) => joinDetailPath('/users', userId),

  roles: '/roles',
  roleDetailPattern: '/roles/:roleId',
  roleDetail: (roleId: string) => joinDetailPath('/roles', roleId),

  orgUnits: '/org-units',
  orgUnitDetailPattern: '/org-units/:orgUnitId',
  orgUnitDetail: (orgUnitId: string) => joinDetailPath('/org-units', orgUnitId),

  employmentProfiles: '/employment-profiles',
  employmentProfileDetailPattern: '/employment-profiles/:employmentProfileId',
  employmentProfileDetail: (employmentProfileId: string) =>
    joinDetailPath('/employment-profiles', employmentProfileId),

  talents: '/talents',
  talentDetailPattern: '/talents/:talentId',
  talentDetail: (talentId: string) => joinDetailPath('/talents', talentId),

  talentGroups: '/talent-groups',
  talentGroupDetailPattern: '/talent-groups/:groupId',
  talentGroupDetail: (groupId: string) => joinDetailPath('/talent-groups', groupId),

  platformAccounts: '/platform-accounts',
  platformAccountDetailPattern: '/platform-accounts/:platformAccountId',
  platformAccountDetail: (platformAccountId: string) =>
    joinDetailPath('/platform-accounts', platformAccountId),

  studioResources: '/studio-resources',
  studioResourceDetailPattern: '/studio-resources/:studioResourceId',
  studioResourceDetail: (studioResourceId: string) =>
    joinDetailPath('/studio-resources', studioResourceId),

  workShifts: '/work-shifts',
  workShiftDetailPattern: '/work-shifts/:workShiftId',
  workShiftDetail: (workShiftId: string) => joinDetailPath('/work-shifts', workShiftId),
  workScheduleMyShifts: '/work-schedule/my-shifts',
  workScheduleTeamShifts: '/work-schedule/team-shifts',
  workScheduleDepartmentShifts: '/work-schedule/department-shifts',
  workScheduleGlobalOps: '/work-schedule/global-ops',
  workPatterns: '/work-schedule/patterns',
  workPatternDetailPattern: '/work-schedule/patterns/:workPatternId',
  workPatternDetail: (workPatternId: string) =>
    joinDetailPath('/work-schedule/patterns', workPatternId),
  holidayCalendars: '/work-schedule/holiday-calendars',
  holidayCalendarDetailPattern: '/work-schedule/holiday-calendars/:holidayCalendarId',
  holidayCalendarDetail: (holidayCalendarId: string) =>
    joinDetailPath('/work-schedule/holiday-calendars', holidayCalendarId),
  monthlyRosters: '/work-schedule/rosters',
  monthlyRosterDetailPattern: '/work-schedule/rosters/:monthlyRosterId',
  monthlyRosterDetail: (monthlyRosterId: string) =>
    joinDetailPath('/work-schedule/rosters', monthlyRosterId),

  events: '/events',
  eventDetailPattern: '/events/:eventId',
  eventDetail: (eventId: string) => joinDetailPath('/events', eventId),

  contractRecords: '/contract-records',
  contractRecordDetailPattern: '/contract-records/:contractRecordId',
  contractRecordDetail: (contractRecordId: string) =>
    joinDetailPath('/contract-records', contractRecordId),

  talentKpiRecords: '/talent-kpi-records',
  talentKpiRecordDetailPattern: '/talent-kpi-records/:talentKpiRecordId',
  talentKpiRecordDetail: (talentKpiRecordId: string) =>
    joinDetailPath('/talent-kpi-records', talentKpiRecordId),

  kpi: '/kpi',
  kpiPlans: '/kpi/plans',
  kpiPlanDetailPattern: '/kpi/plans/:kpiPlanId',
  kpiPlanDetail: (kpiPlanId: string) => joinDetailPath('/kpi/plans', kpiPlanId),
  kpiActualEntry: '/kpi/actual-entry',
  kpiMy: '/kpi/my',

  revenueEntries: '/revenue-entries',
  revenueEntryDetailPattern: '/revenue-entries/:revenueEntryId',
  revenueEntryDetail: (revenueEntryId: string) =>
    joinDetailPath('/revenue-entries', revenueEntryId),

  commission: '/commission',
  commissionRules: '/commission/rules',
  commissionRuleDetailPattern: '/commission/rules/:commissionRuleId',
  commissionRuleDetail: (commissionRuleId: string) =>
    joinDetailPath('/commission/rules', commissionRuleId),

  commissionSettlements: '/commission/settlements',
  commissionSettlementDetailPattern: '/commission/settlements/:commissionSettlementId',
  commissionSettlementDetail: (commissionSettlementId: string) =>
    joinDetailPath('/commission/settlements', commissionSettlementId),

  login: '/auth/login',
  callback: '/auth/callback',
  forbidden: '/forbidden',
} as const;
