import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { useModulePageActions } from '@app/providers/module-runtime';
import { TalentCreateSurface } from '@modules/talent/forms/talent-mutation-forms';
import {
  useCreateTalentMutation,
  useTalentLifecycleMutation,
  useTalentList,
} from '@modules/talent/hooks/use-talent';
import { createTalentListColumns } from '@modules/talent/tables/talent-columns';
import {
  talentCommercialParticipationStatusValues,
  talentOriginValues,
  type TalentLifecycleAction,
} from '@modules/talent/types/talent.types';
import type { NormalizedApiError } from '@shared/api';
import {
  canShowAction,
  PERMISSIONS,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  AppliedFilterChips,
  type AppliedFilterChipItem,
  AdminTableShell,
  CursorPager,
  ErrorState,
  FilterToolbar,
  LoadingState,
  MoreFiltersPanel,
  PermissionDeniedState,
  SearchBoxSeam,
  SortControlSeam,
  useDestructiveConfirm,
  useModalHost,
  useMutationFeedback,
} from '@shared/components/primitives';
import { talentFlatListQueryConfig } from '@modules/talent';
import { createCursorStack, moveNextCursor, movePreviousCursor } from '@shared/query/cursor';
import { serializeScreenQueryParams } from '@shared/query/screen-query-config';
import { useRouteQueryState } from '@shared/query/use-route-query-state';
import { ModuleListScreenShell } from '@shared/modules';

const readErrorMessage = (
  t: (key: string) => string,
  error: NormalizedApiError | null | undefined,
  fallbackKey: string,
): string => {
  if (!error?.message) {
    return t(fallbackKey);
  }

  if (error.message.includes(':')) {
    return t(error.message);
  }

  return error.message;
};

const sortOptions = [
  { value: 'talentCode', labelKey: 'talent:sort.talentCode' },
  { value: 'stageName', labelKey: 'talent:sort.stageName' },
  { value: 'legalName', labelKey: 'talent:sort.legalName' },
  { value: 'createdAt', labelKey: 'talent:sort.createdAt' },
] as const;

const operationalStatusOptions = ['', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED'] as const;
const talentOriginOptions = ['', ...talentOriginValues] as const;
const commercialParticipationStatusOptions = [
  '',
  ...talentCommercialParticipationStatusValues,
] as const;

const readLifecycleConfirmKey = (action: TalentLifecycleAction): string => {
  switch (action) {
    case 'suspend':
      return 'talent:confirm.suspend';
    case 'reactivate':
      return 'talent:confirm.reactivate';
    case 'deactivate':
      return 'talent:confirm.deactivate';
    case 'archive':
      return 'talent:confirm.archive';
    default:
      return 'talent:confirm.archive';
  }
};

export const TalentListPage = (): JSX.Element => {
  const { t } = useTranslation(['talent', 'common', 'errors']);
  const navigate = useNavigate();
  const { query, patchQuery } = useRouteQueryState(talentFlatListQueryConfig);
  const listQuery = useMemo(() => query, [query]);

  const listQueryResult = useTalentList(listQuery);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const createMutation = useCreateTalentMutation();
  const lifecycleMutation = useTalentLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const { close: closeModal, openDrawer } = useModalHost();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    return serializeScreenQueryParams(
      {
        ...query,
        cursor: undefined,
      },
      talentFlatListQueryConfig,
    ).toString();
  }, [query]);
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }

    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  const canCreateTalent = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.TALENT_CREATE,
  });
  const canManageTalentLifecycle = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.TALENT_MANAGE_LIFECYCLE,
  });

  const pageActions = canCreateTalent ? (
    <button
      type="button"
      onClick={() => setIsCreateOpen((current) => !current)}
      className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
    >
      {isCreateOpen ? t('talent:actions.closeCreate') : t('talent:actions.create')}
    </button>
  ) : null;

  useModulePageActions(pageActions);

  const nextCursor = listQueryResult.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(query.cursor);

  const onNext = (): void => {
    if (!nextCursor) {
      return;
    }

    setCursorStack((current) => moveNextCursor(current, nextCursor));
    patchQuery(
      {
        cursor: nextCursor,
      },
      { resetCursorOnChange: false },
    );
  };

  const onPrevious = (): void => {
    setCursorStack((current) => {
      const nextStack = movePreviousCursor(current);
      patchQuery(
        {
          cursor: nextStack.current ?? undefined,
        },
        { resetCursorOnChange: false },
      );

      return nextStack;
    });
  };

  const onCreateSubmit = useCallback(
    async (payload: Parameters<typeof createMutation.mutateAsync>[0]) => {
      try {
        await createMutation.mutateAsync(payload);
        notifySuccess('talent:feedback.created');
        setIsCreateOpen(false);
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [createMutation, notifyError, notifySuccess],
  );

  useEffect(() => {
    if (!isCreateOpen || !canCreateTalent) {
      closeModal();
      return;
    }

    openDrawer({
      title: t('talent:mutations.create.title'),
      onDismiss: () => setIsCreateOpen(false),
      content: (
        <TalentCreateSurface
          presentation="drawer"
          isPending={createMutation.isPending}
          onCancel={() => setIsCreateOpen(false)}
          onSubmit={onCreateSubmit}
        />
      ),
    });
  }, [
    canCreateTalent,
    closeModal,
    createMutation.isPending,
    isCreateOpen,
    onCreateSubmit,
    openDrawer,
    t,
  ]);

  useEffect(
    () => () => {
      closeModal();
    },
    [closeModal],
  );

  const onLifecycleAction = useCallback(
    async (talentId: string, action: TalentLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });

      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          talentId,
          action,
        });
        notifySuccess('talent:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createTalentListColumns(t, {
        onOpenDetail: (talentId) => navigate(APP_PATHS.talentDetail(talentId)),
        onLifecycleAction,
        canShowLifecycleAction: () => canManageTalentLifecycle,
        isActionPending: (talentId, action) => {
          return (
            lifecycleMutation.isPending &&
            lifecycleMutation.variables?.talentId === talentId &&
            lifecycleMutation.variables?.action === action
          );
        },
      }),
    [
      canManageTalentLifecycle,
      lifecycleMutation.isPending,
      lifecycleMutation.variables,
      navigate,
      onLifecycleAction,
      t,
    ],
  );

  const listError = listQueryResult.error as NormalizedApiError | null;
  const shellState = useMemo(() => {
    if (listQueryResult.isPending) {
      return 'loading' as const;
    }

    if (listQueryResult.isError) {
      if (listError?.permissionDenied) {
        return 'denied' as const;
      }

      return 'error' as const;
    }

    return 'ready' as const;
  }, [listError?.permissionDenied, listQueryResult.isError, listQueryResult.isPending]);

  const moreFilterCount = [
    query.talentOrigin,
    query.hasLinkedEmploymentProfile,
    query.commercialParticipationStatus,
    query.livestreamEligible,
    query.eventEligible,
  ].filter((value) => value !== undefined).length;
  const clearTalentFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      operationalStatus: undefined,
      talentOrigin: undefined,
      hasLinkedEmploymentProfile: undefined,
      commercialParticipationStatus: undefined,
      livestreamEligible: undefined,
      eventEligible: undefined,
    });
  }, [patchQuery]);
  const appliedFilterChips = useMemo<AppliedFilterChipItem[]>(() => {
    const items: AppliedFilterChipItem[] = [];

    if (query.search) {
      items.push({
        id: 'search',
        label: t('common:labels.search'),
        value: query.search,
        onClear: () => patchQuery({ search: undefined }),
      });
    }

    if (query.operationalStatus) {
      items.push({
        id: 'operational-status',
        label: t('talent:filters.operationalStatus'),
        value: t(`talent:statuses.${query.operationalStatus}`),
        onClear: () => patchQuery({ operationalStatus: undefined }),
      });
    }

    if (query.talentOrigin) {
      items.push({
        id: 'talent-origin',
        label: t('talent:filters.talentOrigin'),
        value: t(`talent:origins.${query.talentOrigin}`),
        onClear: () => patchQuery({ talentOrigin: undefined }),
      });
    }

    if (query.hasLinkedEmploymentProfile !== undefined) {
      items.push({
        id: 'linked-employment-profile',
        label: t('talent:filters.hasLinkedEmploymentProfile'),
        value: query.hasLinkedEmploymentProfile
          ? t('talent:filters.linkedOnly')
          : t('talent:filters.unlinkedOnly'),
        onClear: () => patchQuery({ hasLinkedEmploymentProfile: undefined }),
      });
    }

    if (query.commercialParticipationStatus) {
      items.push({
        id: 'commercial-participation-status',
        label: t('talent:filters.commercialParticipationStatus'),
        value: t(`talent:commercialStatuses.${query.commercialParticipationStatus}`),
        onClear: () => patchQuery({ commercialParticipationStatus: undefined }),
      });
    }

    if (query.livestreamEligible !== undefined) {
      items.push({
        id: 'livestream-eligible',
        label: t('talent:filters.livestreamEligible'),
        value: t(`talent:boolean.${query.livestreamEligible ? 'true' : 'false'}`),
        onClear: () => patchQuery({ livestreamEligible: undefined }),
      });
    }

    if (query.eventEligible !== undefined) {
      items.push({
        id: 'event-eligible',
        label: t('talent:filters.eventEligible'),
        value: t(`talent:boolean.${query.eventEligible ? 'true' : 'false'}`),
        onClear: () => patchQuery({ eventEligible: undefined }),
      });
    }

    return items;
  }, [
    patchQuery,
    query.commercialParticipationStatus,
    query.eventEligible,
    query.hasLinkedEmploymentProfile,
    query.livestreamEligible,
    query.operationalStatus,
    query.search,
    query.talentOrigin,
    t,
  ]);

  return (
    <ModuleListScreenShell
      filterBar={
        <FilterToolbar
          searchSlot={
            <SearchBoxSeam
              value={query.search ?? ''}
              placeholder={t('talent:filters.searchPlaceholder')}
              onApply={(value) => {
                patchQuery({
                  search: value || undefined,
                });
              }}
            />
          }
          sortSlot={
            <SortControlSeam
              sortBy={query.sortBy}
              sortDirection={query.sortDirection}
              options={sortOptions.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              onChange={(sortBy, sortDirection) =>
                patchQuery({
                  sortBy,
                  sortDirection,
                })
              }
            />
          }
          moreFiltersTrigger={
            <button
              type="button"
              aria-expanded={isMoreFiltersOpen}
              aria-controls="talent-more-filters"
              onClick={() => setIsMoreFiltersOpen((current) => !current)}
              className="rounded border border-border bg-panel px-3 py-1.5 text-sm font-medium"
            >
              {t('common:filters.moreFilters')}
              {moreFilterCount > 0 ? ` (${moreFilterCount})` : ''}
            </button>
          }
          moreFiltersPanel={
            <MoreFiltersPanel
              id="talent-more-filters"
              title={t('common:filters.moreFilters')}
              closeLabel={t('common:actions.close')}
              isOpen={isMoreFiltersOpen}
              onClose={() => setIsMoreFiltersOpen(false)}
            >
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('talent:filters.talentOrigin')}
                </span>
                <select
                  value={query.talentOrigin ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      talentOrigin: event.target.value || undefined,
                    })
                  }
                >
                  {talentOriginOptions.map((option) => (
                    <option key={option || 'all'} value={option}>
                      {option
                        ? t(`talent:origins.${option}`)
                        : t('talent:filters.allTalentOrigins')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('talent:filters.hasLinkedEmploymentProfile')}
                </span>
                <select
                  value={
                    query.hasLinkedEmploymentProfile === undefined
                      ? ''
                      : query.hasLinkedEmploymentProfile
                        ? 'true'
                        : 'false'
                  }
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) => {
                    const value = event.target.value;
                    patchQuery({
                      hasLinkedEmploymentProfile: value === '' ? undefined : value === 'true',
                    });
                  }}
                >
                  <option value="">{t('talent:filters.allLinkedEmploymentProfileStates')}</option>
                  <option value="true">{t('talent:filters.linkedOnly')}</option>
                  <option value="false">{t('talent:filters.unlinkedOnly')}</option>
                </select>
              </label>
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('talent:filters.commercialParticipationStatus')}
                </span>
                <select
                  value={query.commercialParticipationStatus ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      commercialParticipationStatus: event.target.value || undefined,
                    })
                  }
                >
                  {commercialParticipationStatusOptions.map((option) => (
                    <option key={option || 'all'} value={option}>
                      {option
                        ? t(`talent:commercialStatuses.${option}`)
                        : t('talent:filters.allCommercialParticipationStatuses')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('talent:filters.livestreamEligible')}
                </span>
                <select
                  value={
                    query.livestreamEligible === undefined
                      ? ''
                      : query.livestreamEligible
                        ? 'true'
                        : 'false'
                  }
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) => {
                    const value = event.target.value;
                    patchQuery({
                      livestreamEligible: value === '' ? undefined : value === 'true',
                    });
                  }}
                >
                  <option value="">{t('talent:filters.allEligibilityStates')}</option>
                  <option value="true">{t('talent:boolean.true')}</option>
                  <option value="false">{t('talent:boolean.false')}</option>
                </select>
              </label>
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('talent:filters.eventEligible')}
                </span>
                <select
                  value={
                    query.eventEligible === undefined ? '' : query.eventEligible ? 'true' : 'false'
                  }
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) => {
                    const value = event.target.value;
                    patchQuery({
                      eventEligible: value === '' ? undefined : value === 'true',
                    });
                  }}
                >
                  <option value="">{t('talent:filters.allEligibilityStates')}</option>
                  <option value="true">{t('talent:boolean.true')}</option>
                  <option value="false">{t('talent:boolean.false')}</option>
                </select>
              </label>
            </MoreFiltersPanel>
          }
          appliedFilters={
            <AppliedFilterChips
              title={t('common:filters.appliedFilters')}
              items={appliedFilterChips}
              clearFilterLabel={t('common:filters.clearFilter')}
              clearAllLabel={t('common:filters.clearAll')}
              onClearAll={appliedFilterChips.length > 0 ? clearTalentFilters : undefined}
            />
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('talent:filters.operationalStatus')}
            </span>
            <select
              value={query.operationalStatus ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  operationalStatus: (event.target.value ||
                    undefined) as typeof query.operationalStatus,
                })
              }
            >
              {operationalStatusOptions.map((statusOption) => (
                <option key={statusOption || 'all'} value={statusOption}>
                  {statusOption
                    ? t(`talent:statuses.${statusOption}`)
                    : t('talent:filters.allOperationalStatuses')}
                </option>
              ))}
            </select>
          </label>
        </FilterToolbar>
      }
      tableSection={
        <div className="space-y-4">
          <AdminTableShell
            data={listQueryResult.data?.data ?? []}
            columns={columns}
            isLoading={listQueryResult.isFetching && !listQueryResult.data}
            emptyTitle={t('talent:states.emptyTitle')}
            emptyMessage={t('talent:states.emptyMessage')}
            caption={t('talent:table.caption')}
          />
        </div>
      }
      pager={
        <CursorPager
          canGoBack={canGoBack}
          canGoNext={canGoNext}
          onNext={onNext}
          onPrevious={onPrevious}
        />
      }
      state={shellState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      errorState={
        <ErrorState
          title={t('talent:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'talent:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
