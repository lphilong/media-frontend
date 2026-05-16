import { useFieldArray, useFormContext } from 'react-hook-form';

import { ReferencePickerField } from '@shared/forms/ReferencePickerField';
import type { ReferenceOption } from '@shared/components/reference';

type ReferenceIdSetEditorProps = {
  name: string;
  idFieldName: string;
  pickerId: string;
  loadOptions: (search: string) => Promise<ReferenceOption[]>;
  title: string;
  fieldLabel: string;
  addLabel: string;
  removeLabel: (index: number) => string;
  emptyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
};

export const ReferenceIdSetEditor = ({
  name,
  idFieldName,
  pickerId,
  loadOptions,
  title,
  fieldLabel,
  addLabel,
  removeLabel,
  emptyLabel,
  placeholder,
  disabled = false,
}: ReferenceIdSetEditorProps): JSX.Element => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => append({ [idFieldName]: '' })}
          disabled={disabled}
        >
          {addLabel}
        </button>
      </div>

      {fields.length === 0 && emptyLabel ? (
        <p className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
          {emptyLabel}
        </p>
      ) : null}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <fieldset key={field.id} className="space-y-3 rounded border border-border bg-panel p-3">
            <ReferencePickerField
              name={`${name}.${index}.${idFieldName}`}
              label={fieldLabel}
              pickerId={`${pickerId}-${index}`}
              loadOptions={loadOptions}
              placeholder={placeholder}
              disabled={disabled}
            />
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => remove(index)}
              disabled={disabled}
            >
              {removeLabel(index + 1)}
            </button>
          </fieldset>
        ))}
      </div>
    </section>
  );
};
