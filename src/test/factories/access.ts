import type {
  AccountContext,
  ActorScopeGrantModule,
  CurrentActorCapabilities,
  PermissionCode,
} from '@shared/auth/current-actor-capabilities';

type ScopeGrantMap = CurrentActorCapabilities['scopeGrants'];
type WorkspaceAvailability = NonNullable<CurrentActorCapabilities['workspaceAvailability']>;
export type TestActorCapabilities = Omit<
  CurrentActorCapabilities,
  'generatedAt' | 'roles' | 'type'
> & {
  generatedAt: string;
  roles: string[];
  type: 'admin' | 'staff';
};

const accountContextPriority: AccountContext[] = [
  'ADMIN_CONSOLE',
  'MANAGER_CONSOLE',
  'STAFF_CONSOLE',
];

export type CreateWorkspaceAvailabilityOptions = {
  accountContexts?: readonly AccountContext[];
  primaryWorkspace?: AccountContext | null;
};

export const createAccountContexts = (
  accountContexts: readonly AccountContext[] = [],
): AccountContext[] => Array.from(new Set(accountContexts));

export const createWorkspaceAvailability = ({
  accountContexts = [],
  primaryWorkspace,
}: CreateWorkspaceAvailabilityOptions = {}): WorkspaceAvailability => {
  const contexts = createAccountContexts(accountContexts);
  const resolvedPrimaryWorkspace =
    primaryWorkspace === undefined
      ? (accountContextPriority.find((context) => contexts.includes(context)) ?? null)
      : primaryWorkspace;

  return {
    primaryWorkspace: resolvedPrimaryWorkspace,
    availableWorkspaces: accountContextPriority
      .slice()
      .reverse()
      .map((context) => {
        const available = contexts.includes(context);

        return {
          context,
          available,
          source: 'ACCOUNT_CONTEXT' as const,
          reasonCodes: available ? ['ACCOUNT_CONTEXT_ACTIVE'] : ['ACCOUNT_CONTEXT_MISSING'],
          trace: [{ source: 'ACCOUNT_CONTEXT', context, matched: available }],
        };
      }),
    ownDataAvailable: contexts.includes('STAFF_CONSOLE'),
    managerResponsibilitiesAvailable: contexts.includes('MANAGER_CONSOLE'),
    effectiveAccessTraceAvailable: contexts.length > 0,
    sourceTrace:
      contexts.length > 0
        ? [
            {
              source: 'ACCOUNT_CONTEXT',
              accountContexts: contexts,
              primaryWorkspace: resolvedPrimaryWorkspace,
            },
          ]
        : [],
  };
};

export const createScopeGrants = (
  grants: Partial<ScopeGrantMap> = {},
): CurrentActorCapabilities['scopeGrants'] => ({ ...grants });

export const createScopeGrant = <
  TModule extends ActorScopeGrantModule,
  TValue extends NonNullable<ScopeGrantMap[TModule]>[number],
>(
  module: TModule,
  values: readonly TValue[],
): Pick<ScopeGrantMap, TModule> =>
  ({ [module]: [...values] }) as unknown as Pick<ScopeGrantMap, TModule>;

export type CreateActorCapabilitiesOptions = Partial<
  Omit<TestActorCapabilities, 'context' | 'scopeGrants'>
> & {
  context?: TestActorCapabilities['context'];
  permissions?: readonly PermissionCode[];
  scopeGrants?: Partial<ScopeGrantMap>;
  accountContexts?: readonly AccountContext[];
};

export const createActorCapabilities = ({
  accountContexts = [],
  generatedAt = '2026-06-01T00:00:00.000Z',
  id = 'test-actor',
  isActive = true,
  permissions = [],
  roles = [],
  scopeGrants = {},
  type = 'admin',
  workspaceAvailability,
  ...overrides
}: CreateActorCapabilitiesOptions = {}): TestActorCapabilities => {
  const contexts = createAccountContexts(accountContexts);

  return {
    id,
    type,
    context: 'ADMIN',
    isActive,
    roles: [...roles],
    permissions: [...permissions],
    scopeGrants: createScopeGrants(scopeGrants),
    accountContexts: contexts,
    workspaceAvailability:
      workspaceAvailability ?? createWorkspaceAvailability({ accountContexts: contexts }),
    generatedAt,
    ...overrides,
  };
};

export const createFailClosedActorCapabilities = (
  overrides: Omit<CreateActorCapabilitiesOptions, 'accountContexts' | 'workspaceAvailability'> = {},
): TestActorCapabilities => {
  return createActorCapabilities({
    ...overrides,
    accountContexts: [],
    workspaceAvailability: createWorkspaceAvailability({ accountContexts: [] }),
  });
};

export const makeFinanceScope = (
  overrides: Partial<Pick<ScopeGrantMap, 'contractRegistry' | 'revenueLedger' | 'commission'>> = {},
): Pick<ScopeGrantMap, 'contractRegistry' | 'revenueLedger' | 'commission'> => ({
  contractRegistry: [],
  revenueLedger: [],
  commission: [],
  ...overrides,
});
