import { useTranslation } from 'react-i18next';

type CursorPagerProps = {
  canGoBack: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export const CursorPager = ({
  canGoBack,
  canGoNext,
  onPrevious,
  onNext,
}: CursorPagerProps): JSX.Element => {
  const { t } = useTranslation('common');

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoBack}
        className="rounded border border-border bg-panel px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('actions.previous')}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className="rounded border border-border bg-panel px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('actions.next')}
      </button>
    </div>
  );
};
