import type { NormalizedApiError } from '@shared/api';

type InlineFormErrorProps = {
  message?: string;
};

export const InlineFormError = ({ message }: InlineFormErrorProps): JSX.Element | null => {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs font-medium text-danger">{message}</p>;
};

type InlineFormErrorListProps = {
  errors?: string[];
};

export const InlineFormErrorList = ({ errors }: InlineFormErrorListProps): JSX.Element | null => {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <ul className="mt-1 space-y-1 text-xs font-medium text-danger">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
};

export const readFieldErrors = (
  apiError: NormalizedApiError | null | undefined,
  fieldName: string,
): string[] => {
  if (!apiError) {
    return [];
  }

  return apiError.fieldErrors[fieldName] ?? [];
};
