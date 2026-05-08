import { useTranslation } from 'react-i18next';

import { useConfirmDialog } from '@shared/components/primitives/ConfirmDialog';

type DestructiveConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export const useDestructiveConfirm = () => {
  const { t } = useTranslation('common');
  const { confirm } = useConfirmDialog();

  return (options: DestructiveConfirmOptions): Promise<boolean> => {
    return confirm({
      title: options.title ?? t('dialogs.destructive.title'),
      description: options.description,
      confirmLabel: options.confirmLabel ?? t('actions.confirmDestructive'),
      cancelLabel: options.cancelLabel ?? t('actions.cancel'),
      confirmTone: 'danger',
    });
  };
};
