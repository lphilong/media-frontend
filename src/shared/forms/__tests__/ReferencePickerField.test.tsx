import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { vi } from 'vitest';

import type { ReferenceOption } from '@shared/components/reference';
import { ReferencePickerField } from '@shared/forms/ReferencePickerField';
import { setLocale } from '@shared/i18n/i18n';

type TestFormValues = {
  referenceId: string;
};

const loadOptions = vi.fn(async (): Promise<ReferenceOption[]> => [
  {
    id: 'reference-01',
    label: 'Reference One',
    code: 'REF-001',
  },
]);

const ValueProbe = (): JSX.Element => {
  const { control } = useFormContext<TestFormValues>();
  const value = useWatch({ control, name: 'referenceId' });

  return <output data-testid="reference-value">{value}</output>;
};

const TestReferencePickerField = ({
  clearable = false,
  initialValue = 'reference-01',
}: {
  clearable?: boolean;
  initialValue?: string;
}): JSX.Element => {
  const methods = useForm<TestFormValues>({
    defaultValues: {
      referenceId: initialValue,
    },
  });

  return (
    <FormProvider {...methods}>
      <ReferencePickerField
        name="referenceId"
        label="Reference"
        pickerId="reference-picker-field"
        loadOptions={loadOptions}
        clearable={clearable}
        clearLabel="Clear reference"
      />
      <ValueProbe />
    </FormProvider>
  );
};

describe('ReferencePickerField', () => {
  beforeEach(async () => {
    loadOptions.mockClear();
    await setLocale('en');
  });

  it('does not duplicate clear actions and clears the field when clearable', async () => {
    const user = userEvent.setup();

    render(<TestReferencePickerField clearable />);

    expect(await screen.findByText('Selected reference')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Clear reference' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Clear reference' }));

    await waitFor(() => {
      expect(screen.getByTestId('reference-value')).toHaveTextContent('');
    });
    expect(screen.queryByText('Selected reference')).not.toBeInTheDocument();
  });

  it('does not show clear UI when not clearable', async () => {
    render(<TestReferencePickerField />);

    expect(await screen.findByText('Selected reference')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear reference' })).not.toBeInTheDocument();
    expect(screen.getByTestId('reference-value')).toHaveTextContent('reference-01');
  });
});
