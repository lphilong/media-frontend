import { describe, expect, it } from 'vitest';

import {
  parseManagedGroupForTest,
  parseManagedMemberForTest,
  managerWorkspaceReadQueryKeys,
} from '@modules/manager-workspace/api/manager-workspace.api';

const externalMember = {
  personKind: 'EXTERNAL_ONLY',
  operationalMemberId: null,
  displayName: 'External Creator',
  employeeCode: null,
  operationalStatus: 'ACTIVE',
  trace: {
    talentId: 'talent-external',
    talentCode: 'TL-EXT',
    membershipId: 'membership-external',
    membershipStatus: 'ACTIVE',
    joinedAt: 1,
    leftAt: null,
  },
  eligibility: { kpi: false, schedule: false, actualEntry: false, mutation: false },
  readinessReasonCodes: ['ACTIVE_EMPLOYMENT_PROFILE_LINK_REQUIRED'],
  navigation: { memberRef: null },
};

describe('Manager group/member runtime contracts', () => {
  it('accepts safe discriminated group and external-only member DTOs', () => {
    expect(
      parseManagedGroupForTest({
        scopeType: 'TALENT_GROUP',
        scopeId: 'tg-1',
        code: 'TG-1',
        displayName: 'Talent Group',
        operationalStatus: 'ACTIVE',
        responsibility: null,
        readiness: { memberReadAvailable: true, reasonCodes: [] },
        navigation: {
          groupRef: 'TALENT_GROUP:tg-1',
          membersRef: 'TALENT_GROUP:tg-1:members',
        },
      }).scopeType,
    ).toBe('TALENT_GROUP');
    expect(parseManagedMemberForTest(externalMember).operationalMemberId).toBeNull();
  });

  it('rejects private fields and fabricated external-only operational targets', () => {
    expect(() =>
      parseManagedMemberForTest({ ...externalMember, legalName: 'Must stay private' }),
    ).toThrow();
    expect(() =>
      parseManagedMemberForTest({
        ...externalMember,
        operationalMemberId: 'fake-employment-profile',
        navigation: { memberRef: 'fake-employment-profile' },
      }),
    ).toThrow();
    expect(() =>
      parseManagedMemberForTest({
        ...externalMember,
        eligibility: { ...externalMember.eligibility, schedule: true },
      }),
    ).toThrow();
  });

  it('separates protected member cache identities by person and readiness filters', () => {
    const identity = {
      actorId: 'manager-1',
      accountContext: 'MANAGER_CONSOLE' as const,
      scopeFingerprint: 'scope-v1',
    };
    const scope = { scopeType: 'ORG_UNIT' as const, scopeId: 'ou-1' };
    const eligible = managerWorkspaceReadQueryKeys.members(identity, scope, {
      personKind: 'INTERNAL',
      kpiEligibility: 'ELIGIBLE',
      scheduleEligibility: 'ELIGIBLE',
    });
    const ineligible = managerWorkspaceReadQueryKeys.members(identity, scope, {
      personKind: 'INTERNAL',
      kpiEligibility: 'INELIGIBLE',
      scheduleEligibility: 'INELIGIBLE',
    });
    expect(eligible).not.toEqual(ineligible);
  });
});
