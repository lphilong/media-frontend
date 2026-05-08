import { useTranslation } from 'react-i18next';

type SortOption = {
  value: string;
  label: string;
};

type SortControlSeamProps = {
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  options: SortOption[];
  onChange: (nextSortBy?: string, nextDirection?: 'asc' | 'desc') => void;
};

export const SortControlSeam = ({
  sortBy,
  sortDirection,
  options,
  onChange,
}: SortControlSeamProps): JSX.Element => {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted" htmlFor="module-sort-by">
          {t('labels.sort')}
        </label>
        <select
          id="module-sort-by"
          className="rounded border border-border bg-panel px-2 py-1 text-sm"
          value={sortBy ?? ''}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next || undefined, sortDirection);
          }}
        >
          <option value="">{t('labels.sortDefault')}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          id="module-sort-direction"
          className="rounded border border-border bg-panel px-2 py-1 text-sm"
          value={sortDirection ?? ''}
          onChange={(event) => {
            const next = event.target.value;
            onChange(sortBy, (next as 'asc' | 'desc') || undefined);
          }}
        >
          <option value="">{t('labels.sortDefault')}</option>
          <option value="asc">{t('labels.sortAscending')}</option>
          <option value="desc">{t('labels.sortDescending')}</option>
        </select>
      </div>
    </div>
  );
};
