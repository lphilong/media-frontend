import { useTranslation } from 'react-i18next';

import { ErrorState } from '@shared/components/primitives/ErrorState';

type PermissionDeniedStateProps = {
  message?: string;
};

export const PermissionDeniedState = ({ message }: PermissionDeniedStateProps): JSX.Element => {
  const { t } = useTranslation('errors');

  return (
    <ErrorState
      title={t('permission.title')}
      message={message ?? t('permission.message')}
      variant="inline"
    />
  );
};
