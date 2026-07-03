import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  EmptyState,
  ErrorState,
  LoadingState,
  ReferenceChip,
  StatusBadge,
  type StatusBadgeTone,
} from '@shared/components/primitives';

export type ReferenceOptionBadge = {
  label: string;
  tone?: StatusBadgeTone;
  title?: string;
};

export type ReferenceOption = {
  id: string;
  label: string;
  description?: string;
  secondaryLabel?: string;
  code?: string;
  type?: string;
  status?: string;
  state?: string;
  badges?: ReferenceOptionBadge[];
  href?: string;
  disabled?: boolean;
  meta?: {
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
  clearable?: boolean;
  clearLabel?: string;
  onValidityChange?: (isValid: boolean) => void;
  onSelectedOptionChange?: (option: ReferenceOption | undefined) => void;
  debounceMs?: number;
  showTechnicalMetadata?: boolean;
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

const addUniqueMetadata = (items: string[], value: string | undefined): void => {
  const normalized = value?.trim();

  if (!normalized || items.includes(normalized)) {
    return;
  }

  items.push(normalized);
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
  clearable,
  clearLabel,
  onValidityChange,
  onSelectedOptionChange,
  debounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
  showTechnicalMetadata = true,
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
  const canClear = clearable === true && Boolean(value) && !disabled;
  const listboxId = `${pickerId}-reference-options`;
  const errorMessage = resourceLabel
    ? t('errors:referenceSelector.loadOptionsFailedWithResource', {
        resource: resourceLabel,
      })
    : t('errors:referenceSelector.loadOptionsFailed');
  const loadingLabel = resourceLabel
    ? t('common:referencePicker.loadingWithResource', {
        resource: resourceLabel,
        defaultValue: 'Loading {{resource}} options',
      })
    : t('common:states.loading');

  const getOptionMetadata = useCallback(
    (option: ReferenceOption): string[] => {
      const metadata: string[] = [];

      addUniqueMetadata(metadata, option.description);
      addUniqueMetadata(metadata, option.secondaryLabel);
      addUniqueMetadata(
        metadata,
        showTechnicalMetadata && option.code
          ? t('common:referencePicker.metadata.code', {
              code: option.code,
              defaultValue: 'Code: {{code}}',
            })
          : undefined,
      );
      addUniqueMetadata(
        metadata,
        option.meta?.employeeCode
          ? t('common:referencePicker.metadata.employeeCode', {
              code: option.meta.employeeCode,
              defaultValue: 'Employee code: {{code}}',
            })
          : undefined,
      );
      addUniqueMetadata(
        metadata,
        showTechnicalMetadata && option.meta?.employmentProfileId
          ? t('common:referencePicker.metadata.employmentProfileId', {
              id: option.meta.employmentProfileId,
              defaultValue: 'Employment profile: {{id}}',
            })
          : undefined,
      );
      addUniqueMetadata(
        metadata,
        showTechnicalMetadata && option.id
          ? t('common:referencePicker.metadata.id', {
              id: option.id,
              defaultValue: 'ID: {{id}}',
            })
          : undefined,
      );

      return metadata;
    },
    [showTechnicalMetadata, t],
  );

  const renderOptionBadges = (option: ReferenceOption): ReactNode => {
    const badges: ReferenceOptionBadge[] = [...(option.badges ?? [])];

    if (option.type) {
      badges.push({ label: option.type, tone: 'neutral' });
    }

    if (option.status) {
      badges.push({ label: option.status, tone: 'info' });
    }

    if (option.state && option.state !== option.status) {
      badges.push({ label: option.state, tone: 'muted' });
    }

    if (option.meta?.employmentStatus) {
      badges.push({ label: option.meta.employmentStatus, tone: 'info' });
    }

    if (option.meta?.linkedUserStatus) {
      badges.push({ label: option.meta.linkedUserStatus, tone: 'neutral' });
    }

    if (badges.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-1" aria-label={t('common:referencePicker.badges')}>
        {badges.map((badge) => (
          <StatusBadge
            key={`${badge.label}-${badge.title ?? ''}`}
            label={badge.label}
            tone={badge.tone ?? 'neutral'}
            title={badge.title}
            uppercase={false}
            className="py-0.5"
          />
        ))}
      </div>
    );
  };

  const selectedMetadata = selected ? getOptionMetadata(selected) : [];

  return (
    <section
      className="space-y-3 rounded border border-border bg-panel p-3"
      data-testid="picker-surface"
      data-picker-id={pickerId}
      aria-busy={state === 'loading'}
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
          aria-controls={listboxId}
          aria-describedby={value ? `${pickerId}-selected-reference` : undefined}
          className="w-full rounded border border-border bg-panel px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        />
        {search ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSearch('')}
            className="rounded border border-border bg-panel px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common:actions.clear')}
          </button>
        ) : null}
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
          {loadingSlot ?? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted">{loadingLabel}</p>
              <LoadingState lines={2} variant="inline" />
            </div>
          )}
        </div>
      ) : null}

      {state === 'error' ? (
        <div role="alert">
          {errorSlot ?? (
            <ErrorState
              title={errorMessage}
              message={t('common:referencePicker.errorHelp', {
                defaultValue: 'Retry loading options or adjust the search text.',
              })}
              actionLabel={t('common:actions.retry')}
              onRetry={() => void reload(search)}
              variant="inline"
            />
          )}
        </div>
      ) : null}

      {showEmpty ? (
        <div>
          {emptySlot ?? (
            <EmptyState
              title={t('common:referencePicker.emptyTitle', {
                defaultValue: 'No matching options',
              })}
              message={t('common:referencePicker.emptyMessage', {
                defaultValue:
                  'Try another search term or clear the filter if this field is optional.',
              })}
              variant="inline"
            />
          )}
        </div>
      ) : null}

      {state === 'ready' && options.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={resourceLabel ?? t('common:referencePicker.options')}
          className="max-h-60 space-y-1 overflow-y-auto rounded border border-border bg-bg p-1"
        >
          {options.map((option) => {
            const isSelected = option.id === value;
            const metadata = getOptionMetadata(option);

            return (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={disabled || option.disabled}
                  onClick={() => onChange(option.id)}
                  className="w-full rounded border border-transparent px-3 py-2 text-left text-sm hover:border-border hover:bg-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <span className="block truncate font-medium text-text">{option.label}</span>
                      {metadata.length > 0 ? (
                        <p className="line-clamp-2 text-xs text-muted">{metadata.join(' · ')}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {renderOptionBadges(option)}
                      {isSelected ? (
                        <span
                          className="h-2 w-2 rounded-full bg-accent"
                          aria-label={t('common:referencePicker.selected')}
                        />
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {selectedLabel ? (
        <div
          id={`${pickerId}-selected-reference`}
          className="rounded border border-border bg-bg px-3 py-2 text-sm"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase text-muted">
                {t('common:referencePicker.selected')}
              </p>
              <ReferenceChip label={selectedLabel} to={selectedHref} />
              {selectedMetadata.length > 0 ? (
                <p className="text-xs text-muted">{selectedMetadata.join(' · ')}</p>
              ) : null}
            </div>
            {canClear ? (
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="rounded border border-border bg-panel px-2 py-1 text-xs font-medium text-text hover:bg-slate-50"
              >
                {clearLabel ?? t('common:actions.clear')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
