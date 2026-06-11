import { ListPagination } from '@shared/components/primitives/ListPagination';

type CursorPagerProps = {
  canGoBack: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  limit?: number;
  displayedCount?: number;
  totalCount?: number;
};

export const CursorPager = ({
  canGoBack,
  canGoNext,
  displayedCount,
  limit,
  onPrevious,
  onNext,
  totalCount,
}: CursorPagerProps): JSX.Element => {
  return (
    <ListPagination
      mode="cursor"
      canGoBack={canGoBack}
      canGoNext={canGoNext}
      displayedCount={displayedCount}
      limit={limit}
      onNext={onNext}
      onPrevious={onPrevious}
      totalCount={totalCount}
    />
  );
};
