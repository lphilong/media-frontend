import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, ReferenceChip } from '@shared/components/primitives';

export type ReferenceOption = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  disabled?: boolean;
};

type AsyncReferencePickerState = 'idle' | 'loading' | 'ready' | 'error';

export type AsyncReferencePickerProps = {
  pickerId: string;
  value?: string;
  onChange: (nextId?: string) => void;
  loadOptions: (search: string) => Promise<ReferenceOption[]>;
  disabled?: boolean;
  exactOneId?: boolean;
  placeholder?: string;
  loadingSlot?: ReactNode;
  emptySlot?: ReactNode;
  errorSlot?: ReactNode;
  disabledSlot?: ReactNode;
  onValidityChange?: (isValid: boolean) => void;
};

const findSelectedOption = (
  value: string | undefined,
  options: ReferenceOption[],
): ReferenceOption | undefined => {
  if (!value) {
    return undefined;
  }

  return options.find((option) => option.id === value);
};

export const AsyncReferencePicker = ({
  pickerId,
  value,
  onChange,
  loadOptions,
  disabled = false,
  exactOneId = true,
  placeholder,
  loadingSlot,
  emptySlot,
  errorSlot,
  disabledSlot,
  onValidityChange,
}: AsyncReferencePickerProps): JSX.Element => {
  const { t } = useTranslation(['common', 'errors']);
  const [search, setSearch] = useState('');
  const [state, setState] = useState<AsyncReferencePickerState>('idle');
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const requestIdRef = useRef(0);

  const selected = useMemo(() => findSelectedOption(value, options), [options, value]);

  useEffect(() => {
    onValidityChange?.(!exactOneId || Boolean(value && value.trim().length > 0));
  }, [exactOneId, onValidityChange, value]);

  const reload = useCallback(
    async (query: string): Promise<void> => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setState('loading');

      try {
        const result = await loadOptions(query);
        if (requestId !== requestIdRef.current) {
          return;
        }

        setOptions(result);
        setState('ready');
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setState('error');
      }
    },
    [loadOptions],
  );

  useEffect(() => {
    if (disabled) {
      setState('idle');
      return;
    }

    void reload(search);
  }, [disabled, reload, search]);

  const showEmpty = state === 'ready' && options.length === 0;
  const selectedLabel = selected?.label ?? value;
  const selectedHref = selected?.href;

  return (
    <section
      className="space-y-3 rounded border border-border bg-panel p-3"
      data-testid="picker-surface"
      data-picker-id={pickerId}
    >
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`${pickerId}-reference-search`}>
          {t('common:labels.search')}
        </label>
        <input
          id={`${pickerId}-reference-search`}
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={placeholder ?? t('common:labels.search')}
          className="w-full rounded border border-border bg-panel px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => void reload(search)}
          className="rounded border border-border bg-panel px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('common:actions.search')}
        </button>
      </div>

      {disabled && disabledSlot ? <div>{disabledSlot}</div> : null}

      {state === 'loading' ? (
        <div>
          {loadingSlot ?? <p className="text-xs text-muted">{t('common:states.loading')}</p>}
        </div>
      ) : null}

      {state === 'error' ? (
        <div>
          {errorSlot ?? (
            <ErrorState
              title={t('errors:unexpected.title')}
              message={t('errors:unexpected.message')}
              actionLabel={t('common:actions.retry')}
              onRetry={() => void reload(search)}
              variant="inline"
            />
          )}
        </div>
      ) : null}

      {showEmpty ? <div>{emptySlot ?? null}</div> : null}

      {state === 'ready' && options.length > 0 ? (
        <ul className="max-h-52 space-y-1 overflow-y-auto rounded border border-border bg-bg p-1">
          {options.map((option) => {
            const isSelected = option.id === value;

            return (
              <li key={option.id}>
                <button
                  type="button"
                  disabled={disabled || option.disabled}
                  onClick={() => onChange(option.id)}
                  className="w-full rounded border border-transparent px-2 py-1.5 text-left text-sm hover:border-border hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-text">{option.label}</span>
                    {isSelected ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
                  </div>
                  {option.description ? (
                    <p className="mt-1 text-xs text-muted">{option.description}</p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {selectedLabel ? (
        <div className="rounded border border-border bg-bg px-2 py-2 text-sm">
          <ReferenceChip label={selectedLabel} to={selectedHref} />
        </div>
      ) : null}
    </section>
  );
};
