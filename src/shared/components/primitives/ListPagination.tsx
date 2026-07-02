import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

type PageModePaginationProps = {
  mode: 'page';
  currentPage: number;
  totalPages: number;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  canGoBack?: boolean;
  canGoNext?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onGoToPage?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

type CursorModePaginationProps = {
  mode: 'cursor';
  canGoBack: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  limit?: number;
  displayedCount?: number;
  totalCount?: number;
};

export type ListPaginationProps = PageModePaginationProps | CursorModePaginationProps;

const clampPage = (page: number, totalPages: number): number =>
  Math.min(Math.max(Math.trunc(page), 1), totalPages);

const paginationButtonClass =
  'rounded border border-border bg-panel px-3 py-2 font-medium text-text disabled:cursor-not-allowed disabled:opacity-50';

export const ListPagination = (props: ListPaginationProps): JSX.Element => {
  const { t } = useTranslation('common');
  const [jumpPage, setJumpPage] = useState('');

  if (props.mode === 'cursor') {
    const visibleLimit = props.limit ?? props.displayedCount;

    return (
      <nav
        className="flex flex-wrap items-center justify-end gap-3 text-sm"
        aria-label={t('pagination.navigation')}
      >
        <button
          type="button"
          onClick={props.onPrevious}
          disabled={!props.canGoBack}
          aria-disabled={!props.canGoBack}
          title={!props.canGoBack ? t('pagination.noPrevious') : undefined}
          className={paginationButtonClass}
        >
          {t('actions.previous')}
        </button>
        <div className="text-right text-muted" aria-live="polite">
          {visibleLimit !== undefined ? (
            <p>
              {t('pagination.cursorShowingLimit', {
                count: visibleLimit,
                defaultValue: 'Dang hien thi toi da {{count}} dong',
              })}
            </p>
          ) : null}
          {props.totalCount !== undefined ? (
            <p className="text-xs">
              {t('pagination.totalRows', {
                count: props.totalCount,
                defaultValue: 'Tong so dong: {{count}}',
              })}
            </p>
          ) : null}
          <p className="text-xs">
            {t('pagination.cursorDisclosure', {
              defaultValue: 'Danh sach dung phan trang theo luot tai, khong co tong so trang.',
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={props.onNext}
          disabled={!props.canGoNext}
          aria-disabled={!props.canGoNext}
          title={!props.canGoNext ? t('pagination.noNext') : undefined}
          className={paginationButtonClass}
        >
          {t('actions.next')}
        </button>
      </nav>
    );
  }

  const canGoBack = props.canGoBack ?? props.currentPage > 1;
  const canGoNext = props.canGoNext ?? props.currentPage < props.totalPages;
  const showJump = Boolean(props.onGoToPage && props.totalPages > 0);

  const submitJump = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsedPage = Number(jumpPage);
    if (!Number.isFinite(parsedPage) || !props.onGoToPage) {
      return;
    }

    props.onGoToPage(clampPage(parsedPage, props.totalPages));
    setJumpPage('');
  };

  return (
    <nav
      className="flex flex-wrap items-center justify-end gap-3 text-sm"
      aria-label={t('pagination.navigation')}
    >
      <button
        type="button"
        onClick={props.onPrevious}
        disabled={!canGoBack}
        aria-disabled={!canGoBack}
        title={!canGoBack ? t('pagination.noPrevious') : undefined}
        className={paginationButtonClass}
      >
        {t('actions.previous')}
      </button>
      <span className="font-medium text-text" aria-live="polite">
        {t('pagination.pageStatus', {
          page: props.currentPage,
          total: props.totalPages,
          defaultValue: 'Trang {{page}} / {{total}}',
        })}
      </span>
      <button
        type="button"
        onClick={props.onNext}
        disabled={!canGoNext}
        aria-disabled={!canGoNext}
        title={!canGoNext ? t('pagination.noNext') : undefined}
        className={paginationButtonClass}
      >
        {t('actions.next')}
      </button>
      {showJump ? (
        <form onSubmit={submitJump} className="flex items-center gap-2">
          <label className="text-muted" htmlFor="pagination-jump-page">
            {t('pagination.goToPage')}
          </label>
          <input
            id="pagination-jump-page"
            type="number"
            min={1}
            max={props.totalPages}
            value={jumpPage}
            onChange={(event) => setJumpPage(event.target.value)}
            className="w-20 rounded border border-border bg-panel px-2 py-1.5"
          />
          <button
            type="submit"
            className="rounded border border-border bg-panel px-3 py-1.5 font-medium"
          >
            {t('pagination.go')}
          </button>
        </form>
      ) : null}
      {props.pageSizeOptions && props.onPageSizeChange && props.pageSize ? (
        <label className="flex items-center gap-2 text-muted">
          {t('pagination.pageSize')}
          <select
            value={props.pageSize}
            onChange={(event) => props.onPageSizeChange?.(Number(event.target.value))}
            className="rounded border border-border bg-panel px-2 py-1.5 text-text"
          >
            {props.pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </nav>
  );
};
