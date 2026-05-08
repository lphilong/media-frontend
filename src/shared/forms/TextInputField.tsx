import { useId } from 'react';
import { get, useFormContext } from 'react-hook-form';

type TextInputFieldProps = {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'date';
  step?: string | number;
  min?: string | number;
};

export const TextInputField = ({
  name,
  label,
  placeholder,
  type = 'text',
  step,
  min,
}: TextInputFieldProps): JSX.Element => {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
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
        aria-describedby={fieldError ? errorId : undefined}
        aria-invalid={fieldError ? true : undefined}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
      />
      {fieldError ? (
        <span id={errorId} className="text-xs font-medium text-danger">
          {fieldError}
        </span>
      ) : null}
    </label>
  );
};
