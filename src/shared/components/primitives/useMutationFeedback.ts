import { useTranslation } from 'react-i18next';

import type { NormalizedApiError } from '@shared/api';
import { useToast } from '@shared/components/primitives/ToastHost';

export const useMutationFeedback = () => {
  const { t } = useTranslation(['common', 'errors']);
  const { pushToast } = useToast();

  return {
    notifySuccess: (messageKey = 'common:feedback.saved') => {
      pushToast(t(messageKey), 'success');
    },
    notifyError: (error: NormalizedApiError, fallbackKey = 'errors:transport.generic') => {
      const message = error.message.includes(':') ? t(error.message) : error.message;
      pushToast(message || t(fallbackKey), 'error');
    },
  };
};
