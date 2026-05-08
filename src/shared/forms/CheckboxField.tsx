import { useId } from 'react';
import { get, useFormContext } from 'react-hook-form';

type CheckboxFieldProps = {
  name: string;
  label: string;
};

export const CheckboxField = ({ name, label }: CheckboxFieldProps): JSX.Element => {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const {
    register,
    formState: { errors },
  } = useFormContext();
  const fieldError = get(errors, name)?.message as string | undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-text">
        <input
          id={id}
          type="checkbox"
          {...register(name)}
          aria-labelledby={labelId}
          aria-describedby={fieldError ? errorId : undefined}
          aria-invalid={fieldError ? true : undefined}
          className="h-4 w-4 rounded border-border"
        />
        <span id={labelId}>{label}</span>
      </label>
      {fieldError ? (
        <span id={errorId} className="text-xs font-medium text-danger">
          {fieldError}
        </span>
      ) : null}
    </div>
  );
};
