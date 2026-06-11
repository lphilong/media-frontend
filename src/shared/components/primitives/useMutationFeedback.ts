import { useTranslation } from 'react-i18next';

import type { NormalizedApiError } from '@shared/api';
import { useToast } from '@shared/components/primitives/ToastHost';

export const useMutationFeedback = () => {
  const { t } = useTranslation(['common', 'errors']);
  const { pushToast } = useToast();

  return {
    notifySuccess: (
      messageKey = 'common:feedback.saved',
      values?: Record<string, string | number>,
    ) => {
      pushToast(t(messageKey, values), 'success');
    },
    notifyError: (error: NormalizedApiError, fallbackKey = 'errors:transport.generic') => {
      const message = error.message.includes(':') ? t(error.message) : error.message;
      pushToast(message || t(fallbackKey), 'error');
    },
    notifyWarning: (messageKey: string) => {
      pushToast(t(messageKey), 'warning');
    },
    notifyInfo: (messageKey: string) => {
      pushToast(t(messageKey), 'info');
    },
    notifyNeutral: (messageKey: string) => {
      pushToast(t(messageKey), 'neutral');
    },
  };
};
