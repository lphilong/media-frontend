import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@shared/components/primitives/EmptyState';
import { ErrorState } from '@shared/components/primitives/ErrorState';

export type SemanticStateKind =
  | 'loading'
  | 'no-data'
  | 'no-matching-filters'
  | 'no-permission'
  | 'no-scope'
  | 'missing-profile'
  | 'blocked-profile'
  | 'service-error'
  | 'bounded-results';

type SemanticStateProps = {
  kind: SemanticStateKind;
  title?: string;
  message?: string;
  action?: ReactNode;
  actionLabel?: string;
  onRetry?: () => void;
  variant?: 'panel' | 'inline';
};

export const SemanticState = ({
  action,
  actionLabel,
  kind,
  message,
  onRetry,
  title,
  variant = 'panel',
}: SemanticStateProps): JSX.Element => {
  const { t } = useTranslation('common');
  const resolvedTitle = title ?? t(`semanticStates.${kind}.title`);
  const resolvedMessage = message ?? t(`semanticStates.${kind}.message`);

  if (kind === 'service-error' || kind === 'no-permission') {
    return (
      <ErrorState
        title={resolvedTitle}
        message={resolvedMessage}
        actionLabel={actionLabel}
        onRetry={onRetry}
        variant={variant}
      />
    );
  }

  return (
    <EmptyState title={resolvedTitle} message={resolvedMessage} action={action} variant={variant} />
  );
};
