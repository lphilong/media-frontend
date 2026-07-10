import { roleFlatListQueryConfig } from '@modules/role';
import {
  roleAssignmentRuleReplacementPayloadSchema,
  roleCreateFromTemplatePayloadSchema,
  roleCreatePayloadSchema,
} from '@modules/role/schemas/role-payload-schemas';
import {
  parseScreenQueryParams,
  serializeScreenQueryParams,
} from '@shared/query/screen-query-config';

describe('Role payload and query contracts', () => {
  it('keeps Role list query parsing and serialization limited to documented keys', () => {
    const parsed = parseScreenQueryParams(
      new URLSearchParams(
        'state=ACTIVE&cursor=opaque&limit=250&search=%20Admin%20&scope=global&scopeGrants=x&sortBy=name',
      ),
      roleFlatListQueryConfig,
    );

    expect(parsed).toEqual({ state: 'ACTIVE', cursor: 'opaque', search: 'Admin' });

    const serialized = serializeScreenQueryParams(
      {
        state: 'DRAFT',
        cursor: 'next',
        limit: 50,
        search: 'Ops',
        scope: 'global',
        scopeGrants: 'x',
        sortBy: 'name',
      },
      roleFlatListQueryConfig,
    );

    expect(Array.from(serialized.keys()).sort()).toEqual(['cursor', 'limit', 'search', 'state']);
    expect(serialized.get('scope')).toBeNull();
    expect(serialized.get('scopeGrants')).toBeNull();
    expect(serialized.get('sortBy')).toBeNull();
  });

  it('accepts only strict plain-JSON assignment-rule conditions', () => {
    expect(
      roleAssignmentRuleReplacementPayloadSchema.safeParse({
        rules: [
          {
            code: 'ALLOW_ADMIN',
            conditions: {
              band: 'LIMITED',
              active: true,
              priority: 1,
              nested: { owner: null },
            },
          },
          { code: 'ALLOW_EMPTY', conditions: {} },
          { code: 'ALLOW_NULL', conditions: null },
        ],
      }).success,
    ).toBe(true);

    expect(
      roleCreatePayloadSchema.safeParse({
        name: 'Ops role',
        code: 'OPS',
        initialAssignmentRules: [{ code: 'ALLOW_OPS', conditions: { band: 'LIMITED' } }],
      }).success,
    ).toBe(true);

    expect(
      roleCreateFromTemplatePayloadSchema.safeParse({
        templateCode: 'TALENT_GROUP_MANAGER',
        code: 'TALENT_GROUP_MANAGER_COPY',
        name: 'Team Manager Copy',
        description: null,
      }).success,
    ).toBe(true);

    const forbiddenConditions: unknown[] = [
      [],
      new Date(),
      new Map([['band', 'LIMITED']]),
      new Set(['LIMITED']),
      new Uint8Array([1]),
      { list: [] },
      { createdAt: new Date() },
      { map: new Map([['band', 'LIMITED']]) },
      { fn: () => undefined },
      { sym: Symbol('band') },
      { big: BigInt(1) },
      { toJSON: () => ({ band: 'LIMITED' }) },
      { nested: { toJSON: () => ({ band: 'LIMITED' }) } },
      { nan: Number.NaN },
      { infinite: Number.POSITIVE_INFINITY },
    ];

    for (const conditions of forbiddenConditions) {
      expect(
        roleAssignmentRuleReplacementPayloadSchema.safeParse({
          rules: [{ code: 'ALLOW_ADMIN', conditions }],
        }).success,
      ).toBe(false);
    }
  });
});
