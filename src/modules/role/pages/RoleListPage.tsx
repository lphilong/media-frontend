import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { previewRoleTemplate } from '@modules/role/api/role.api';
import { roleStateValues } from '@modules/role/constants/role.constants';
import { RoleCreateSurface } from '@modules/role/forms/role-mutation-forms';
import {
  useCreateRoleFromTemplateMutation,
  useCreateRoleMutation,
  useRoleLifecycleMutation,
  useRoleList,
  useRoleTemplates,
} from '@modules/role/hooks/use-role';
import { createRoleListColumns } from '@modules/role/tables/role-columns';
import type { RoleLifecycleAction, RoleListQuery } from '@modules/role/types/role.types';
import type { NormalizedApiError } from '@shared/api';
import {
  AdminTableShell,
  CursorPager,
  ErrorState,
  FilterBarShell,
  LoadingState,
  PermissionDeniedState,
  SearchBoxSeam,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { ModuleListScreenShell } from '@shared/modules';
import {
  createCursorStack,
  moveNextCursor,
  movePreviousCursor,
  roleFlatListQueryConfig,
  serializeScreenQueryParams,
  useRouteQueryState,
} from '@shared/query';

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

const readLifecycleConfirmKey = (action: RoleLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'role:confirm.activate';
    case 'deactivate':
      return 'role:confirm.deactivate';
    case 'archive':
      return 'role:confirm.archive';
    default:
      return 'role:confirm.archive';
  }
};

export const RoleListPage = (): JSX.Element => {
  const { t } = useTranslation(['role', 'common', 'errors']);
  const navigate = useNavigate();
  const { query, patchQuery } = useRouteQueryState(roleFlatListQueryConfig);
  const listQueryResult = useRoleList(query);
  const roleTemplatesQuery = useRoleTemplates();
  const createMutation = useCreateRoleMutation();
  const createFromTemplateMutation = useCreateRoleFromTemplateMutation();
  const lifecycleMutation = useRoleLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(
    () =>
      serializeScreenQueryParams(
        {
          ...query,
          cursor: undefined,
        },
        roleFlatListQueryConfig,
      ).toString(),
    [query],
  );
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
      {isCreateOpen ? t('role:actions.closeCreate') : t('role:actions.create')}
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
    patchQuery({ cursor: nextCursor }, { resetCursorOnChange: false });
  };

  const onPrevious = (): void => {
    setCursorStack((current) => {
      const nextStack = movePreviousCursor(current);
      patchQuery({ cursor: nextStack.current ?? undefined }, { resetCursorOnChange: false });

      return nextStack;
    });
  };

  const onCreateSubmit = async (payload: Parameters<typeof createMutation.mutateAsync>[0]) => {
    try {
      await createMutation.mutateAsync(payload);
      notifySuccess('role:feedback.created');
      setIsCreateOpen(false);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onCreateFromTemplateSubmit = async (
    payload: Parameters<typeof createFromTemplateMutation.mutateAsync>[0],
  ) => {
    try {
      await createFromTemplateMutation.mutateAsync(payload);
      notifySuccess('role:feedback.created');
      setIsCreateOpen(false);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onLifecycleAction = useCallback(
    async (roleId: string, action: RoleLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          roleId,
          action,
          payload: action === 'activate' ? undefined : { reason: null },
        });
        notifySuccess('role:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createRoleListColumns(t, {
        onOpenDetail: (roleId) => navigate(APP_PATHS.roleDetail(roleId)),
        onLifecycleAction,
        isActionPending: (roleId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.roleId === roleId &&
          lifecycleMutation.variables?.action === action,
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
              placeholder={t('role:filters.searchPlaceholder')}
              onApply={(value) => patchQuery({ search: value || undefined })}
            />
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('role:filters.state')}
            </span>
            <select
              value={query.state ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  state: (event.target.value || undefined) as RoleListQuery['state'],
                })
              }
            >
              <option value="">{t('role:filters.allStates')}</option>
              {roleStateValues.map((state) => (
                <option key={state} value={state}>
                  {t(`role:states.${state}`)}
                </option>
              ))}
            </select>
          </label>
        </FilterBarShell>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <RoleCreateSurface
              isPending={createMutation.isPending || createFromTemplateMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={onCreateSubmit}
              onTemplateSubmit={onCreateFromTemplateSubmit}
              onPreviewTemplate={previewRoleTemplate}
              templateCatalog={roleTemplatesQuery.data ?? []}
              isTemplateCatalogLoading={roleTemplatesQuery.isLoading}
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
            emptyTitle={t('role:statesView.emptyTitle')}
            emptyMessage={t('role:statesView.emptyMessage')}
            caption={t('role:table.caption')}
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
          title={t('role:statesView.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'role:statesView.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
