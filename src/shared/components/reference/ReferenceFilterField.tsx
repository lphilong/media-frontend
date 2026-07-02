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
  onSelectedOptionChange?: (option: ReferenceOption | undefined) => void;
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
  onSelectedOptionChange,
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
      resourceLabel={label}
      clearable
      clearLabel={clearLabel}
      onSelectedOptionChange={onSelectedOptionChange}
    />
  </fieldset>
);
