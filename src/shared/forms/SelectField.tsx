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
};

export const SelectField = ({ name, label, options }: SelectFieldProps): JSX.Element => {
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
      <select
        id={id}
        {...register(name)}
        aria-labelledby={labelId}
        aria-describedby={fieldError ? errorId : undefined}
        aria-invalid={fieldError ? true : undefined}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {fieldError ? (
        <span id={errorId} className="text-xs font-medium text-danger">
          {fieldError}
        </span>
      ) : null}
    </label>
  );
};
