import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ErrorState,
  LoadingState,
  NotFoundState,
  PermissionDeniedState,
} from '@shared/components/primitives';

export type ModuleSurfaceState = 'ready' | 'loading' | 'empty' | 'error' | 'denied' | 'not-found';

type ModuleSurfaceStateSlots = {
  ready: ReactNode;
  loading?: ReactNode;
  empty?: ReactNode;
  error?: ReactNode;
  denied?: ReactNode;
  notFound?: ReactNode;
};

type ModuleSurfaceStateGateProps = {
  state?: ModuleSurfaceState;
  slots: ModuleSurfaceStateSlots;
};

export const ModuleSurfaceStateGate = ({
  state = 'ready',
  slots,
}: ModuleSurfaceStateGateProps): JSX.Element => {
  const { t } = useTranslation('errors');

  switch (state) {
    case 'ready':
      return <>{slots.ready}</>;
    case 'loading':
      return <>{slots.loading ?? <LoadingState lines={8} variant="table" />}</>;
    case 'empty':
      return <>{slots.empty ?? null}</>;
    case 'error':
      return (
        <>
          {slots.error ?? (
            <ErrorState title={t('unexpected.title')} message={t('unexpected.message')} />
          )}
        </>
      );
    case 'denied':
      return <>{slots.denied ?? <PermissionDeniedState />}</>;
    case 'not-found':
      return <>{slots.notFound ?? <NotFoundState />}</>;
    default:
      return <>{slots.ready}</>;
  }
};
