import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';

import { TextInputField } from '@shared/forms';

const FormHarness = (): JSX.Element => {
  const form = useForm({
    defaultValues: {
      period: '2026-05',
    },
  });

  return (
    <FormProvider {...form}>
      <form>
        <TextInputField
          name="period"
          label="Period"
          type="month"
          min="2026-01"
          max="2026-12"
          helperText="Month field helper"
        />
      </form>
    </FormProvider>
  );
};

describe('TextInputField', () => {
  it('supports month inputs without changing caller-owned date semantics', () => {
    render(<FormHarness />);

    const field = screen.getByLabelText('Period');
    expect(field).toHaveAttribute('type', 'month');
    expect(field).toHaveAttribute('min', '2026-01');
    expect(field).toHaveAttribute('max', '2026-12');
    expect(field).toHaveAccessibleDescription('Month field helper');
  });
});
