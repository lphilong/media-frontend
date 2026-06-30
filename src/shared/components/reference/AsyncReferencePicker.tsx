import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ReferenceChip } from '@shared/components/primitives';

export type ReferenceOption = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  disabled?: boolean;
  meta?: {
    actorKind?: 'ADMIN' | 'STAFF';
    employmentProfileId?: string;
    employeeCode?: string;
    employmentStatus?: string;
    linkedUserStatus?: string;
  };
};

type AsyncReferencePickerState = 'idle' | 'loading' | 'ready' | 'error';

export type AsyncReferencePickerLoadContext = {
  signal: AbortSignal;
};

export type AsyncReferencePickerProps = {
  pickerId: string;
  value?: string;
  onChange: (nextId?: string) => void;
  loadOptions: (
    search: string,
    context?: AsyncReferencePickerLoadContext,
  ) => Promise<ReferenceOption[]>;
  disabled?: boolean;
  exactOneId?: boolean;
  placeholder?: string;
  resourceLabel?: string;
  loadingSlot?: ReactNode;
  emptySlot?: ReactNode;
  errorSlot?: ReactNode;
  disabledSlot?: ReactNode;
  onValidityChange?: (isValid: boolean) => void;
  onSelectedOptionChange?: (option: ReferenceOption | undefined) => void;
  debounceMs?: number;
};

const DEFAULT_SEARCH_DEBOUNCE_MS = 250;

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
  resourceLabel,
  loadingSlot,
  emptySlot,
  errorSlot,
  disabledSlot,
  onValidityChange,
  onSelectedOptionChange,
  debounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
}: AsyncReferencePickerProps): JSX.Element => {
  const { t } = useTranslation(['common', 'errors']);
  const [search, setSearch] = useState('');
  const [state, setState] = useState<AsyncReferencePickerState>('idle');
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const previousSearchRef = useRef<string | undefined>(undefined);

  const selected = useMemo(() => findSelectedOption(value, options), [options, value]);

  useEffect(() => {
    onValidityChange?.(!exactOneId || Boolean(value && value.trim().length > 0));
  }, [exactOneId, onValidityChange, value]);

  useEffect(() => {
    onSelectedOptionChange?.(selected);
  }, [onSelectedOptionChange, selected]);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const abortCurrentRequest = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const reload = useCallback(
    async (query: string): Promise<void> => {
      clearDebounceTimer();
      abortCurrentRequest();
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setState('loading');

      try {
        const result = await loadOptions(query, { signal: abortController.signal });
        if (
          abortController.signal.aborted ||
          requestId !== requestIdRef.current ||
          !mountedRef.current
        ) {
          return;
        }

        setOptions(result);
        setState('ready');
      } catch {
        if (
          abortController.signal.aborted ||
          requestId !== requestIdRef.current ||
          !mountedRef.current
        ) {
          return;
        }

        setState('error');
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [abortCurrentRequest, clearDebounceTimer, loadOptions],
  );

  useEffect(() => {
    if (disabled) {
      clearDebounceTimer();
      abortCurrentRequest();
      requestIdRef.current += 1;
      setState('idle');
      return;
    }

    clearDebounceTimer();
    const previousSearch = previousSearchRef.current;
    const searchChanged = previousSearch !== undefined && previousSearch !== search;
    previousSearchRef.current = search;

    if (!searchChanged) {
      void reload(search);
      return;
    }

    abortCurrentRequest();
    requestIdRef.current += 1;
    debounceTimerRef.current = setTimeout(
      () => {
        debounceTimerRef.current = null;
        void reload(search);
      },
      Math.max(0, debounceMs),
    );

    return clearDebounceTimer;
  }, [abortCurrentRequest, clearDebounceTimer, debounceMs, disabled, reload, search]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      clearDebounceTimer();
      abortCurrentRequest();
    };
  }, [abortCurrentRequest, clearDebounceTimer]);

  const showEmpty = state === 'ready' && options.length === 0;
  const selectedLabel = selected?.label ?? value;
  const selectedHref = selected?.href;
  const errorMessage = resourceLabel
    ? t('errors:referenceSelector.loadOptionsFailedWithResource', {
        resource: resourceLabel,
      })
    : t('errors:referenceSelector.loadOptionsFailed');

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
            <div
              role="alert"
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-danger/30 bg-bg px-2 py-1.5 text-xs"
            >
              <span className="font-medium text-danger">{errorMessage}</span>
              <button
                type="button"
                onClick={() => void reload(search)}
                className="rounded border border-border bg-panel px-2 py-0.5 font-medium text-text hover:bg-slate-50"
              >
                {t('common:actions.retry')}
              </button>
            </div>
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
