import { useId } from 'react';
import { get, useFormContext } from 'react-hook-form';

type SelectFieldOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  name: string;
  label: string;
  options: SelectFieldOption[];
  placeholder?: string;
  helperText?: string;
};

export const SelectField = ({
  name,
  label,
  options,
  placeholder,
  helperText,
}: SelectFieldProps): JSX.Element => {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const fieldError = get(errors, name)?.message as string | undefined;

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span id={labelId} className="text-xs font-medium uppercase text-muted">
        {label}
      </span>
      <select
        id={id}
        {...register(name)}
        aria-labelledby={labelId}
        aria-describedby={[helperText ? helperId : undefined, fieldError ? errorId : undefined]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={fieldError ? true : undefined}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText ? (
        <span id={helperId} className="text-xs text-muted">
          {helperText}
        </span>
      ) : null}
      {fieldError ? (
        <span id={errorId} className="text-xs font-medium text-danger">
          {fieldError}
        </span>
      ) : null}
    </label>
  );
};
