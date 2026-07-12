import { useCallback, useId } from 'react';
import { get, useFormContext } from 'react-hook-form';

import { AsyncReferencePicker, type ReferenceOption } from '@shared/components/reference';

type ReferencePickerFieldProps = {
  name: string;
  label: string;
  pickerId: string;
  loadOptions: (search: string) => Promise<ReferenceOption[]>;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  clearLabel?: string;
  onSelectedOptionChange?: (option: ReferenceOption | undefined) => void;
  selectedLabelFallback?: string;
  showTechnicalMetadata?: boolean;
};

export const ReferencePickerField = ({
  name,
  label,
  pickerId,
  loadOptions,
  helperText,
  placeholder,
  disabled = false,
  clearable = false,
  clearLabel,
  onSelectedOptionChange,
  selectedLabelFallback,
  showTechnicalMetadata,
}: ReferencePickerFieldProps): JSX.Element => {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;
  const {
    clearErrors,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext();
  const value = watch(name) as string | undefined;
  const fieldError = get(errors, name)?.message as string | undefined;

  const handleChange = useCallback(
    (nextId?: string) => {
      setValue(name, nextId ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      clearErrors(name);
    },
    [clearErrors, name, setValue],
  );

  return (
    <fieldset
      className="space-y-2"
      aria-describedby={[helperText ? helpId : undefined, fieldError ? errorId : undefined]
        .filter(Boolean)
        .join(' ')}
    >
      <legend className="text-xs font-medium uppercase text-muted">{label}</legend>
      {helperText ? (
        <p id={helpId} className="text-xs text-muted">
          {helperText}
        </p>
      ) : null}
      <AsyncReferencePicker
        pickerId={pickerId}
        value={value}
        onChange={handleChange}
        loadOptions={loadOptions}
        disabled={disabled}
        exactOneId={false}
        placeholder={placeholder}
        resourceLabel={label}
        onSelectedOptionChange={onSelectedOptionChange}
        selectedLabelFallback={selectedLabelFallback}
        showTechnicalMetadata={showTechnicalMetadata}
      />
      {clearable && value ? (
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs"
          onClick={() => handleChange(undefined)}
        >
          {clearLabel}
        </button>
      ) : null}
      {fieldError ? (
        <span id={errorId} className="text-xs font-medium text-danger">
          {fieldError}
        </span>
      ) : null}
    </fieldset>
  );
};
