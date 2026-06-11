import {
  canAccessModule,
  getAccessibleModuleIds,
  getModuleAccessReason,
  type ModuleAccessModuleId,
} from '@app/router/module-access';
import type { CurrentActorCapabilities } from '@shared/auth/current-actor-capabilities';

const makeCapabilities = (
  overrides: Partial<Pick<CurrentActorCapabilities, 'permissions' | 'roles' | 'scopeGrants'>>,
): CurrentActorCapabilities => ({
  id: 'module-access-test-user',
  type: 'admin',
  context: 'ADMIN',
  isActive: true,
  roles: overrides.roles ?? [],
  permissions: overrides.permissions ?? [],
  scopeGrants: overrides.scopeGrants ?? {},
  generatedAt: '2026-05-24T00:00:00.000Z',
});

const accessible = (
  capabilities: CurrentActorCapabilities,
  moduleIds: readonly ModuleAccessModuleId[],
): ModuleAccessModuleId[] =>
  moduleIds.filter((moduleId) => canAccessModule(capabilities, moduleId));

describe('module access model', () => {
  it('keeps TEAM_MANAGER scoped operations access out of Admin-owned modules', () => {
    const capabilities = makeCapabilities({
      roles: ['TEAM_MANAGER'],
      permissions: [
        'workSchedule.read',
        'event.read',
        'talent.read',
        'talentGroup.read',
        'kpi.read',
        'kpi.readProgress',
      ],
      scopeGrants: {
        workSchedule: ['self', 'team'],
        eventAssignment: ['managedGroup'],
        kpi: ['managedGroup'],
      },
    });

    expect(
      accessible(capabilities, [
        'kpi',
        'event-assignment',
        'talent',
        'talent-group',
        'work-schedule',
        'user',
        'role',
        'contract-registry',
        'revenue-ledger',
        'commission-rules',
        'commission-settlements',
        'people-readiness',
      ]),
    ).toEqual(['talent', 'talent-group']);
    expect(canAccessModule(capabilities, 'people-readiness')).toBe(false);
    expect(canAccessModule(capabilities, 'kpi')).toBe(false);
    expect(canAccessModule(capabilities, 'event-assignment')).toBe(false);
    expect(canAccessModule(capabilities, 'work-schedule')).toBe(false);
    expect(canAccessModule(capabilities, 'contract-registry')).toBe(false);
  });

  it('keeps Admin KPI access for global and global plus managed KPI actors', () => {
    const globalCapabilities = makeCapabilities({
      permissions: ['kpi.read'],
      scopeGrants: { kpi: ['global'] },
    });
    const globalManagedCapabilities = makeCapabilities({
      permissions: ['kpi.read', 'kpi.readProgress'],
      scopeGrants: { kpi: ['global', 'managedGroup'] },
    });

    expect(canAccessModule(globalCapabilities, 'kpi')).toBe(true);
    expect(canAccessModule(globalManagedCapabilities, 'kpi')).toBe(true);
  });

  it('allows PRODUCTION_OPS event and operational modules by read permission plus scopes', () => {
    const capabilities = makeCapabilities({
      roles: ['PRODUCTION_OPS'],
      permissions: [
        'event.read',
        'workSchedule.read',
        'platformAccount.read',
        'studioResource.read',
      ],
      scopeGrants: {
        eventAssignment: ['global'],
        workSchedule: ['global'],
      },
    });

    expect(
      accessible(capabilities, [
        'event-assignment',
        'work-schedule',
        'platform-account',
        'studio-resource',
        'contract-registry',
      ]),
    ).toEqual(['event-assignment', 'work-schedule', 'platform-account', 'studio-resource']);
  });

  it('denies HR_OPERATIONS department schedule scope from Admin WorkSchedule ownership', () => {
    const capabilities = makeCapabilities({
      roles: ['HR_OPERATIONS'],
      permissions: [
        'orgUnit.read',
        'employmentProfile.read',
        'talent.read',
        'talentGroup.read',
        'workSchedule.read',
        'studioResource.lookup',
      ],
      scopeGrants: {
        workSchedule: ['department'],
      },
    });

    expect(canAccessModule(capabilities, 'work-schedule')).toBe(false);
    expect(canAccessModule(capabilities, 'studio-resource')).toBe(false);
  });

  it('keeps Admin WorkSchedule and Events access for global plus scoped actors', () => {
    const capabilities = makeCapabilities({
      roles: ['PRODUCTION_OPS', 'TEAM_MANAGER'],
      permissions: ['event.read', 'workSchedule.read'],
      scopeGrants: {
        eventAssignment: ['global', 'managedGroup'],
        workSchedule: ['global', 'team', 'department'],
      },
    });

    expect(canAccessModule(capabilities, 'work-schedule')).toBe(true);
    expect(canAccessModule(capabilities, 'event-assignment')).toBe(true);
  });

  it.each([
    ['team scoped WorkSchedule', 'team'],
    ['self scoped WorkSchedule', 'self'],
    ['department scoped WorkSchedule', 'department'],
  ] as const)('denies Admin WorkSchedule for %s actors', (_name, scope) => {
    const capabilities = makeCapabilities({
      permissions: ['workSchedule.read'],
      scopeGrants: { workSchedule: [scope] },
    });

    expect(canAccessModule(capabilities, 'work-schedule')).toBe(false);
  });

  it('denies Admin Events for managedGroup-only actors', () => {
    const capabilities = makeCapabilities({
      permissions: ['event.read'],
      scopeGrants: { eventAssignment: ['managedGroup'] },
    });

    expect(canAccessModule(capabilities, 'event-assignment')).toBe(false);
  });

  it('keeps COMMERCIAL_FINANCE lookup permissions from unlocking full modules', () => {
    const capabilities = makeCapabilities({
      roles: ['COMMERCIAL_FINANCE'],
      permissions: [
        'orgUnit.lookup',
        'contractRegistry.read',
        'revenueLedger.read',
        'commissionRule.read',
        'commissionSettlement.read',
        'event.lookup',
        'talent.lookup',
        'platformAccount.lookup',
        'kpi.read',
        'kpi.readProgress',
      ],
      scopeGrants: {
        contractRegistry: ['global'],
        revenueLedger: ['global'],
        commission: ['global'],
        kpi: ['global'],
      },
    });

    expect(canAccessModule(capabilities, 'contract-registry')).toBe(true);
    expect(canAccessModule(capabilities, 'revenue-ledger')).toBe(true);
    expect(canAccessModule(capabilities, 'commission-rules')).toBe(true);
    expect(canAccessModule(capabilities, 'commission-settlements')).toBe(true);
    expect(canAccessModule(capabilities, 'kpi')).toBe(true);
    expect(canAccessModule(capabilities, 'event-assignment')).toBe(false);
    expect(canAccessModule(capabilities, 'org-unit')).toBe(false);
    expect(canAccessModule(capabilities, 'talent')).toBe(false);
    expect(canAccessModule(capabilities, 'platform-account')).toBe(false);
  });

  it('allows VIEWER_AUDITOR read routes without asserting mutation action access', () => {
    const capabilities = makeCapabilities({
      roles: ['VIEWER_AUDITOR'],
      permissions: [
        'orgUnit.read',
        'employmentProfile.read',
        'talent.read',
        'talentGroup.read',
        'platformAccount.read',
        'studioResource.read',
        'event.read',
        'workSchedule.read',
        'contractRegistry.read',
        'talentKpi.read',
        'kpi.read',
        'kpi.readProgress',
        'commissionRule.read',
        'commissionSettlement.read',
        'revenueLedger.read',
        'dashboardLite.read',
        'employmentProfile.read',
      ],
      scopeGrants: {
        dashboardLite: ['global'],
        workSchedule: ['global'],
        eventAssignment: ['global'],
        contractRegistry: ['global'],
        talentKpi: ['global'],
        kpi: ['global'],
        revenueLedger: ['global'],
        commission: ['global'],
      },
    });

    expect(getAccessibleModuleIds(capabilities)).toEqual([
      'dashboard',
      'people-readiness',
      'org-unit',
      'employment-profile',
      'talent',
      'talent-group',
      'platform-account',
      'studio-resource',
      'work-schedule',
      'event-assignment',
      'contract-registry',
      'talent-kpi',
      'kpi',
      'revenue-ledger',
      'commission-rules',
      'commission-settlements',
    ]);
  });

  it('keeps self-only actors off unsupported admin modules', () => {
    const capabilities = makeCapabilities({
      roles: ['TALENT_STAFF_SELF'],
      permissions: [
        'workSchedule.read',
        'event.read',
        'employmentProfile.read',
        'talent.read',
        'kpi.readProgress',
      ],
      scopeGrants: {
        workSchedule: ['self'],
        kpi: ['self'],
      },
    });

    expect(canAccessModule(capabilities, 'work-schedule')).toBe(false);
    expect(canAccessModule(capabilities, 'event-assignment')).toBe(false);
    expect(canAccessModule(capabilities, 'employment-profile')).toBe(false);
    expect(canAccessModule(capabilities, 'people-readiness')).toBe(false);
    expect(canAccessModule(capabilities, 'talent')).toBe(false);
    expect(canAccessModule(capabilities, 'kpi')).toBe(false);
  });

  it('reports No Access causes for direct routes missing permission or scope', () => {
    expect(
      getModuleAccessReason(
        makeCapabilities({
          permissions: ['event.lookup'],
          scopeGrants: { eventAssignment: ['global'] },
        }),
        'event-assignment',
      ),
    ).toBe('missing-permission');

    expect(
      getModuleAccessReason(
        makeCapabilities({
          permissions: ['event.read'],
          scopeGrants: {},
        }),
        'event-assignment',
      ),
    ).toBe('missing-scope');
  });
});
