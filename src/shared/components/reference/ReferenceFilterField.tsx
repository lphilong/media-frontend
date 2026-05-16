import {
  AsyncReferencePicker,
  type ReferenceOption,
} from '@shared/components/reference/AsyncReferencePicker';

type ReferenceFilterFieldProps = {
  label: string;
  pickerId: string;
  value?: string;
  loadOptions: (search: string) => Promise<ReferenceOption[]>;
  onChange: (nextId?: string) => void;
  placeholder?: string;
  clearLabel: string;
  disabled?: boolean;
  className?: string;
};

export const ReferenceFilterField = ({
  label,
  pickerId,
  value,
  loadOptions,
  onChange,
  placeholder,
  clearLabel,
  disabled = false,
  className = 'min-w-[220px]',
}: ReferenceFilterFieldProps): JSX.Element => (
  <fieldset className={`flex flex-col gap-1 ${className}`}>
    <legend className="text-xs font-medium uppercase text-muted">{label}</legend>
    <AsyncReferencePicker
      pickerId={pickerId}
      value={value}
      onChange={onChange}
      loadOptions={loadOptions}
      disabled={disabled}
      exactOneId={false}
      placeholder={placeholder}
    />
    {value ? (
      <button
        type="button"
        className="self-start rounded border border-border px-2 py-1 text-xs"
        onClick={() => onChange(undefined)}
      >
        {clearLabel}
      </button>
    ) : null}
  </fieldset>
);
