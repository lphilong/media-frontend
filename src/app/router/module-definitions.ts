import { APP_PATHS } from '@app/router/paths';
import type { ModuleAccessModuleId } from '@app/router/module-access';
import type { I18nNamespace } from '@shared/i18n/constants';

export type NavGroup =
  | 'overview'
  | 'identityAccess'
  | 'organization'
  | 'talentOwnership'
  | 'operations'
  | 'commercial';

export type ModuleRouteDefinition = {
  id: string;
  listPath: string;
  detailPath?: string;
  detailParamKey?: string;
  namespace: I18nNamespace;
  navGroup: NavGroup;
  navItemKey: string;
  listTitleKey: string;
  listSubtitleKey: string;
  detailTitleKey?: string;
  detailSubtitleKey?: string;
  placeholderKey: string;
};

export const moduleRouteDefinitions: ModuleRouteDefinition[] = [
  {
    id: 'dashboard',
    listPath: APP_PATHS.dashboard,
    namespace: 'dashboard-lite',
    navGroup: 'overview',
    navItemKey: 'dashboard',
    listTitleKey: 'dashboard-lite:page.title',
    listSubtitleKey: 'dashboard-lite:page.subtitle',
    placeholderKey: 'dashboard-lite:page.placeholder',
  },
  {
    id: 'people-readiness',
    listPath: APP_PATHS.peopleReadiness,
    namespace: 'people-readiness',
    navGroup: 'organization',
    navItemKey: 'peopleReadiness',
    listTitleKey: 'people-readiness:page.title',
    listSubtitleKey: 'people-readiness:page.subtitle',
    placeholderKey: 'people-readiness:page.placeholder',
  },
  {
    id: 'user',
    listPath: APP_PATHS.users,
    detailPath: APP_PATHS.userDetailPattern,
    detailParamKey: 'userId',
    namespace: 'user',
    navGroup: 'identityAccess',
    navItemKey: 'users',
    listTitleKey: 'user:page.title',
    listSubtitleKey: 'user:page.subtitle',
    detailTitleKey: 'user:page.title',
    detailSubtitleKey: 'user:page.subtitle',
    placeholderKey: 'user:page.placeholder',
  },
  {
    id: 'role',
    listPath: APP_PATHS.roles,
    detailPath: APP_PATHS.roleDetailPattern,
    detailParamKey: 'roleId',
    namespace: 'role',
    navGroup: 'identityAccess',
    navItemKey: 'roles',
    listTitleKey: 'role:page.title',
    listSubtitleKey: 'role:page.subtitle',
    detailTitleKey: 'role:page.title',
    detailSubtitleKey: 'role:page.subtitle',
    placeholderKey: 'role:page.placeholder',
  },
  {
    id: 'org-unit',
    listPath: APP_PATHS.orgUnits,
    detailPath: APP_PATHS.orgUnitDetailPattern,
    detailParamKey: 'orgUnitId',
    namespace: 'org-unit',
    navGroup: 'organization',
    navItemKey: 'orgUnits',
    listTitleKey: 'org-unit:page.title',
    listSubtitleKey: 'org-unit:page.subtitle',
    detailTitleKey: 'org-unit:page.title',
    detailSubtitleKey: 'org-unit:page.subtitle',
    placeholderKey: 'org-unit:page.placeholder',
  },
  {
    id: 'employment-profile',
    listPath: APP_PATHS.employmentProfiles,
    detailPath: APP_PATHS.employmentProfileDetailPattern,
    detailParamKey: 'employmentProfileId',
    namespace: 'employment-profile',
    navGroup: 'organization',
    navItemKey: 'employmentProfiles',
    listTitleKey: 'employment-profile:page.title',
    listSubtitleKey: 'employment-profile:page.subtitle',
    detailTitleKey: 'employment-profile:page.title',
    detailSubtitleKey: 'employment-profile:page.subtitle',
    placeholderKey: 'employment-profile:page.placeholder',
  },
  {
    id: 'employment-terms',
    listPath: APP_PATHS.employmentTerms,
    namespace: 'employment-terms',
    navGroup: 'organization',
    navItemKey: 'employmentTerms',
    listTitleKey: 'employment-terms:page.title',
    listSubtitleKey: 'employment-terms:page.subtitle',
    placeholderKey: 'employment-terms:page.placeholder',
  },
  {
    id: 'talent',
    listPath: APP_PATHS.talents,
    detailPath: APP_PATHS.talentDetailPattern,
    detailParamKey: 'talentId',
    namespace: 'talent',
    navGroup: 'talentOwnership',
    navItemKey: 'talents',
    listTitleKey: 'talent:page.title',
    listSubtitleKey: 'talent:page.subtitle',
    detailTitleKey: 'talent:page.title',
    detailSubtitleKey: 'talent:page.subtitle',
    placeholderKey: 'talent:page.placeholder',
  },
  {
    id: 'talent-group',
    listPath: APP_PATHS.talentGroups,
    detailPath: APP_PATHS.talentGroupDetailPattern,
    detailParamKey: 'groupId',
    namespace: 'talent-group',
    navGroup: 'talentOwnership',
    navItemKey: 'talentGroups',
    listTitleKey: 'talent-group:page.title',
    listSubtitleKey: 'talent-group:page.subtitle',
    detailTitleKey: 'talent-group:page.title',
    detailSubtitleKey: 'talent-group:page.subtitle',
    placeholderKey: 'talent-group:page.placeholder',
  },
  {
    id: 'platform-account',
    listPath: APP_PATHS.platformAccounts,
    detailPath: APP_PATHS.platformAccountDetailPattern,
    detailParamKey: 'platformAccountId',
    namespace: 'platform-account',
    navGroup: 'talentOwnership',
    navItemKey: 'platformAccounts',
    listTitleKey: 'platform-account:page.title',
    listSubtitleKey: 'platform-account:page.subtitle',
    detailTitleKey: 'platform-account:page.title',
    detailSubtitleKey: 'platform-account:page.subtitle',
    placeholderKey: 'platform-account:page.placeholder',
  },
  {
    id: 'studio-resource',
    listPath: APP_PATHS.studioResources,
    detailPath: APP_PATHS.studioResourceDetailPattern,
    detailParamKey: 'studioResourceId',
    namespace: 'studio-resource',
    navGroup: 'talentOwnership',
    navItemKey: 'studioResources',
    listTitleKey: 'studio-resource:page.title',
    listSubtitleKey: 'studio-resource:page.subtitle',
    detailTitleKey: 'studio-resource:page.title',
    detailSubtitleKey: 'studio-resource:page.subtitle',
    placeholderKey: 'studio-resource:page.placeholder',
  },
  {
    id: 'work-schedule',
    listPath: APP_PATHS.workShifts,
    detailPath: APP_PATHS.workShiftDetailPattern,
    detailParamKey: 'workShiftId',
    namespace: 'work-schedule',
    navGroup: 'operations',
    navItemKey: 'workShifts',
    listTitleKey: 'work-schedule:surfaces.globalOps.title',
    listSubtitleKey: 'work-schedule:surfaces.globalOps.subtitle',
    detailTitleKey: 'work-schedule:page.title',
    detailSubtitleKey: 'work-schedule:page.subtitle',
    placeholderKey: 'work-schedule:page.placeholder',
  },
  {
    id: 'event-assignment',
    listPath: APP_PATHS.events,
    detailPath: APP_PATHS.eventDetailPattern,
    detailParamKey: 'eventId',
    namespace: 'event-assignment',
    navGroup: 'operations',
    navItemKey: 'events',
    listTitleKey: 'event-assignment:page.title',
    listSubtitleKey: 'event-assignment:page.subtitle',
    detailTitleKey: 'event-assignment:page.title',
    detailSubtitleKey: 'event-assignment:page.subtitle',
    placeholderKey: 'event-assignment:page.placeholder',
  },
  {
    id: 'contract-registry',
    listPath: APP_PATHS.contractRecords,
    detailPath: APP_PATHS.contractRecordDetailPattern,
    detailParamKey: 'contractRecordId',
    namespace: 'contract-registry',
    navGroup: 'commercial',
    navItemKey: 'contractRegistry',
    listTitleKey: 'contract-registry:page.title',
    listSubtitleKey: 'contract-registry:page.subtitle',
    detailTitleKey: 'contract-registry:page.title',
    detailSubtitleKey: 'contract-registry:page.subtitle',
    placeholderKey: 'contract-registry:page.placeholder',
  },
  {
    id: 'talent-kpi',
    listPath: APP_PATHS.talentKpiRecords,
    detailPath: APP_PATHS.talentKpiRecordDetailPattern,
    detailParamKey: 'talentKpiRecordId',
    namespace: 'talent-kpi',
    navGroup: 'commercial',
    navItemKey: 'talentKpi',
    listTitleKey: 'talent-kpi:page.title',
    listSubtitleKey: 'talent-kpi:page.subtitle',
    detailTitleKey: 'talent-kpi:page.title',
    detailSubtitleKey: 'talent-kpi:page.subtitle',
    placeholderKey: 'talent-kpi:page.placeholder',
  },
  {
    id: 'kpi',
    listPath: APP_PATHS.kpi,
    detailPath: APP_PATHS.kpiPlanDetailPattern,
    detailParamKey: 'kpiPlanId',
    namespace: 'kpi',
    navGroup: 'commercial',
    navItemKey: 'kpi',
    listTitleKey: 'kpi:page.title',
    listSubtitleKey: 'kpi:page.subtitle',
    detailTitleKey: 'kpi:detail.pageTitle',
    detailSubtitleKey: 'kpi:detail.pageSubtitle',
    placeholderKey: 'kpi:page.placeholder',
  },
  {
    id: 'revenue-ledger',
    listPath: APP_PATHS.revenueEntries,
    detailPath: APP_PATHS.revenueEntryDetailPattern,
    detailParamKey: 'revenueEntryId',
    namespace: 'revenue-ledger',
    navGroup: 'commercial',
    navItemKey: 'revenueLedger',
    listTitleKey: 'revenue-ledger:page.title',
    listSubtitleKey: 'revenue-ledger:page.subtitle',
    detailTitleKey: 'revenue-ledger:page.title',
    detailSubtitleKey: 'revenue-ledger:page.subtitle',
    placeholderKey: 'revenue-ledger:page.placeholder',
  },
  {
    id: 'commission-rules',
    listPath: APP_PATHS.commissionRules,
    detailPath: APP_PATHS.commissionRuleDetailPattern,
    detailParamKey: 'commissionRuleId',
    namespace: 'commission',
    navGroup: 'commercial',
    navItemKey: 'commissionRules',
    listTitleKey: 'commission:rules.title',
    listSubtitleKey: 'commission:rules.subtitle',
    detailTitleKey: 'commission:rules.title',
    detailSubtitleKey: 'commission:rules.subtitle',
    placeholderKey: 'commission:rules.placeholder',
  },
  {
    id: 'commission-settlements',
    listPath: APP_PATHS.commissionSettlements,
    detailPath: APP_PATHS.commissionSettlementDetailPattern,
    detailParamKey: 'commissionSettlementId',
    namespace: 'commission',
    navGroup: 'commercial',
    navItemKey: 'commissionSettlements',
    listTitleKey: 'commission:settlements.title',
    listSubtitleKey: 'commission:settlements.subtitle',
    detailTitleKey: 'commission:settlements.title',
    detailSubtitleKey: 'commission:settlements.subtitle',
    placeholderKey: 'commission:settlements.placeholder',
  },
];

export type ShellNavigationItem = {
  id: string;
  moduleId?: ModuleAccessModuleId;
  navItemKey: string;
  to?: string;
  children?: ShellNavigationItem[];
};

export type ShellNavigationGroup = {
  id: NavGroup;
  items: ShellNavigationItem[];
};

export const shellNavigationGroups: ShellNavigationGroup[] = [
  {
    id: 'overview',
    items: [
      {
        id: 'dashboard',
        moduleId: 'dashboard',
        navItemKey: 'dashboard',
        to: APP_PATHS.dashboard,
      },
    ],
  },
  {
    id: 'identityAccess',
    items: [
      { id: 'users', moduleId: 'user', navItemKey: 'users', to: APP_PATHS.users },
      { id: 'roles', moduleId: 'role', navItemKey: 'roles', to: APP_PATHS.roles },
    ],
  },
  {
    id: 'organization',
    items: [
      { id: 'org-units', moduleId: 'org-unit', navItemKey: 'orgUnits', to: APP_PATHS.orgUnits },
      {
        id: 'employment-profiles',
        moduleId: 'employment-profile',
        navItemKey: 'employmentProfiles',
        to: APP_PATHS.employmentProfiles,
      },
      {
        id: 'employment-terms',
        moduleId: 'employment-terms',
        navItemKey: 'employmentTerms',
        to: APP_PATHS.employmentTerms,
      },
      {
        id: 'people-readiness',
        moduleId: 'people-readiness',
        navItemKey: 'peopleReadiness',
        to: APP_PATHS.peopleReadiness,
      },
    ],
  },
  {
    id: 'talentOwnership',
    items: [
      { id: 'talents', moduleId: 'talent', navItemKey: 'talents', to: APP_PATHS.talents },
      {
        id: 'talent-groups',
        moduleId: 'talent-group',
        navItemKey: 'talentGroups',
        to: APP_PATHS.talentGroups,
      },
      {
        id: 'platform-accounts',
        moduleId: 'platform-account',
        navItemKey: 'platformAccounts',
        to: APP_PATHS.platformAccounts,
      },
      {
        id: 'studio-resources',
        moduleId: 'studio-resource',
        navItemKey: 'studioResources',
        to: APP_PATHS.studioResources,
      },
    ],
  },
  {
    id: 'operations',
    items: [
      {
        id: 'work-shifts',
        moduleId: 'work-schedule',
        navItemKey: 'workShifts',
        to: APP_PATHS.workShifts,
      },
      {
        id: 'events',
        moduleId: 'event-assignment',
        navItemKey: 'events',
        to: APP_PATHS.events,
      },
    ],
  },
  {
    id: 'commercial',
    items: [
      {
        id: 'contract-registry',
        moduleId: 'contract-registry',
        navItemKey: 'contractRegistry',
        to: APP_PATHS.contractRecords,
      },
      { id: 'kpi', moduleId: 'kpi', navItemKey: 'kpi', to: APP_PATHS.kpi },
      {
        id: 'revenue-ledger',
        moduleId: 'revenue-ledger',
        navItemKey: 'revenueLedger',
        to: APP_PATHS.revenueEntries,
      },
      {
        id: 'commission',
        navItemKey: 'commission',
        children: [
          {
            id: 'commission-rules',
            moduleId: 'commission-rules',
            navItemKey: 'commissionRules',
            to: APP_PATHS.commissionRules,
          },
          {
            id: 'commission-settlements',
            moduleId: 'commission-settlements',
            navItemKey: 'commissionSettlements',
            to: APP_PATHS.commissionSettlements,
          },
        ],
      },
    ],
  },
];
