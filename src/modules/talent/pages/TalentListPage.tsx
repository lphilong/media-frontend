import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
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
  AdminTableShell,
  CursorPager,
  ErrorState,
  FilterBarShell,
  LoadingState,
  PermissionDeniedState,
  SearchBoxSeam,
  SortControlSeam,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import {
  createCursorStack,
  moveNextCursor,
  movePreviousCursor,
  serializeScreenQueryParams,
  talentFlatListQueryConfig,
  useRouteQueryState,
} from '@shared/query';
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
  const createMutation = useCreateTalentMutation();
  const lifecycleMutation = useTalentLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  const pageActions = (
    <button
      type="button"
      onClick={() => setIsCreateOpen((current) => !current)}
      className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
    >
      {isCreateOpen ? t('talent:actions.closeCreate') : t('talent:actions.create')}
    </button>
  );

  usePageActions(pageActions);

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

  const onCreateSubmit = async (payload: Parameters<typeof createMutation.mutateAsync>[0]) => {
    try {
      await createMutation.mutateAsync(payload);
      notifySuccess('talent:feedback.created');
      setIsCreateOpen(false);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

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
        isActionPending: (talentId, action) => {
          return (
            lifecycleMutation.isPending &&
            lifecycleMutation.variables?.talentId === talentId &&
            lifecycleMutation.variables?.action === action
          );
        },
      }),
    [lifecycleMutation.isPending, lifecycleMutation.variables, navigate, onLifecycleAction, t],
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

  return (
    <ModuleListScreenShell
      filterBar={
        <FilterBarShell
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
                  {option ? t(`talent:origins.${option}`) : t('talent:filters.allTalentOrigins')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('talent:filters.managerEmploymentProfileId')}
            </span>
            <input
              value={query.managerEmploymentProfileId ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              placeholder={t('talent:filters.managerEmploymentProfileIdPlaceholder')}
              onChange={(event) =>
                patchQuery({
                  managerEmploymentProfileId: event.target.value || undefined,
                })
              }
            />
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
        </FilterBarShell>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <TalentCreateSurface
              isPending={createMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={onCreateSubmit}
            />
          ) : null}
        </>
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
