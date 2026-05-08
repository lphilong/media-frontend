import { useTranslation } from 'react-i18next';

import { ErrorState } from '@shared/components/primitives/ErrorState';

type NotFoundStateProps = {
  message?: string;
};

export const NotFoundState = ({ message }: NotFoundStateProps): JSX.Element => {
  const { t } = useTranslation('errors');

  return (
    <ErrorState
      title={t('notFound.title')}
      message={message ?? t('notFound.message')}
      variant="inline"
    />
  );
};
