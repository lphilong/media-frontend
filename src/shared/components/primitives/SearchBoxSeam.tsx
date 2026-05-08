import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, type FormEvent } from 'react';

type SearchBoxSeamProps = {
  value: string;
  onApply: (value: string) => void;
  placeholder?: string;
};

export const SearchBoxSeam = ({ value, onApply, placeholder }: SearchBoxSeamProps): JSX.Element => {
  const { t } = useTranslation('common');
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    onApply(draft.trim());
  };

  return (
    <form onSubmit={onSubmit} className="flex min-w-[220px] flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="module-search">
          {t('labels.search')}
        </label>
        <input
          id="module-search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder ?? t('labels.search')}
          className="w-full rounded border border-border bg-panel px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-panel hover:bg-slate-50"
          aria-label={t('actions.search')}
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
};
