import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { usePageActions } from '@app/store/use-page-actions';
import { APP_PATHS } from '@app/router/paths';
import { EmploymentProfileCreateSurface } from '@modules/employment-profile/forms/employment-profile-mutation-forms';
import {
  useCreateEmploymentProfileMutation,
  useEmploymentProfileList,
} from '@modules/employment-profile/hooks/use-employment-profile';
import { createEmploymentProfileListColumns } from '@modules/employment-profile/tables/employment-profile-columns';
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
} from '@shared/components/primitives';
import { useMutationFeedback } from '@shared/components/primitives';
import {
  createCursorStack,
  employmentProfileFlatListQueryConfig,
  moveNextCursor,
  movePreviousCursor,
  serializeScreenQueryParams,
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
  { value: 'employeeCode', labelKey: 'employment-profile:sort.employeeCode' },
  { value: 'displayName', labelKey: 'employment-profile:sort.displayName' },
  { value: 'legalName', labelKey: 'employment-profile:sort.legalName' },
  { value: 'createdAt', labelKey: 'employment-profile:sort.createdAt' },
] as const;

const employmentStatusOptions = [
  '',
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'TERMINATED',
  'ARCHIVED',
] as const;
const contractStatusOptions = [
  '',
  'NONE',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
] as const;

export const EmploymentProfileListPage = (): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common', 'errors']);
  const navigate = useNavigate();
  const { query, patchQuery } = useRouteQueryState(employmentProfileFlatListQueryConfig);
  const listQuery = useMemo(() => query, [query]);

  const listQueryResult = useEmploymentProfileList(listQuery);
  const createMutation = useCreateEmploymentProfileMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    return serializeScreenQueryParams(
      {
        ...query,
        cursor: undefined,
      },
      employmentProfileFlatListQueryConfig,
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
      {isCreateOpen
        ? t('employment-profile:actions.closeCreate')
        : t('employment-profile:actions.create')}
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
      notifySuccess('employment-profile:feedback.created');
      setIsCreateOpen(false);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const columns = useMemo(
    () =>
      createEmploymentProfileListColumns(t, {
        onOpenDetail: (employmentProfileId) =>
          navigate(APP_PATHS.employmentProfileDetail(employmentProfileId)),
      }),
    [navigate, t],
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
              placeholder={t('employment-profile:filters.searchPlaceholder')}
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
              {t('employment-profile:filters.employmentStatus')}
            </span>
            <select
              value={query.employmentStatus ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  employmentStatus: (event.target.value ||
                    undefined) as typeof query.employmentStatus,
                })
              }
            >
              {employmentStatusOptions.map((statusOption) => (
                <option key={statusOption || 'all'} value={statusOption}>
                  {statusOption
                    ? t(`employment-profile:statuses.${statusOption}`)
                    : t('employment-profile:filters.allEmploymentStatuses')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('employment-profile:filters.contractStatus')}
            </span>
            <select
              value={query.contractStatus ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  contractStatus: (event.target.value || undefined) as typeof query.contractStatus,
                })
              }
            >
              {contractStatusOptions.map((statusOption) => (
                <option key={statusOption || 'all'} value={statusOption}>
                  {statusOption
                    ? t(`employment-profile:contractStatuses.${statusOption}`)
                    : t('employment-profile:filters.allContractStatuses')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('employment-profile:filters.employmentKind')}
            </span>
            <input
              value={query.employmentKind ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              placeholder={t('employment-profile:filters.employmentKindPlaceholder')}
              onChange={(event) =>
                patchQuery({
                  employmentKind: event.target.value || undefined,
                })
              }
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('employment-profile:filters.orgUnitId')}
            </span>
            <input
              value={query.orgUnitId ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              placeholder={t('employment-profile:filters.orgUnitIdPlaceholder')}
              onChange={(event) =>
                patchQuery({
                  orgUnitId: event.target.value || undefined,
                })
              }
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('employment-profile:filters.managerEmploymentProfileId')}
            </span>
            <input
              value={query.managerEmploymentProfileId ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              placeholder={t('employment-profile:filters.managerEmploymentProfileIdPlaceholder')}
              onChange={(event) =>
                patchQuery({
                  managerEmploymentProfileId: event.target.value || undefined,
                })
              }
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('employment-profile:filters.hasLinkedUser')}
            </span>
            <select
              value={
                query.hasLinkedUser === undefined ? '' : query.hasLinkedUser ? 'true' : 'false'
              }
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => {
                const value = event.target.value;
                patchQuery({
                  hasLinkedUser: value === '' ? undefined : value === 'true',
                });
              }}
            >
              <option value="">{t('employment-profile:filters.allLinkedUserStates')}</option>
              <option value="true">{t('employment-profile:filters.linkedOnly')}</option>
              <option value="false">{t('employment-profile:filters.unlinkedOnly')}</option>
            </select>
          </label>
        </FilterBarShell>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <EmploymentProfileCreateSurface
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
            emptyTitle={t('employment-profile:states.emptyTitle')}
            emptyMessage={t('employment-profile:states.emptyMessage')}
            caption={t('employment-profile:table.caption')}
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
          title={t('employment-profile:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'employment-profile:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
