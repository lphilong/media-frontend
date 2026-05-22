import { useId } from 'react';
import { get, useFormContext } from 'react-hook-form';

type TextInputFieldProps = {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'datetime-local';
  step?: string | number;
  min?: string | number;
  helperText?: string;
};

export const TextInputField = ({
  name,
  label,
  placeholder,
  type = 'text',
  step,
  min,
  helperText,
}: TextInputFieldProps): JSX.Element => {
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
      <input
        id={id}
        type={type}
        step={step}
        min={min}
        {...register(name)}
        placeholder={placeholder}
        aria-labelledby={labelId}
        aria-describedby={[helperText ? helperId : undefined, fieldError ? errorId : undefined]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={fieldError ? true : undefined}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
      />
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
