import i18n from 'i18next';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import {
  TalentCommercialParticipationSurface,
  TalentCreateSurface,
  TalentEditSurface,
  TalentEmploymentLinkSurface,
  TalentManagerAssignmentSurface,
} from '@modules/talent/forms/talent-mutation-forms';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';

vi.mock('@shared/components/reference/admin-reference-options', () => ({
  loadEmploymentProfileReferenceOptions: vi.fn(async () => [
    {
      id: 'ep-001',
      label: 'Manager One - EP-000001',
      description: 'ACTIVE',
      href: '/employment-profiles/ep-001',
    },
    {
      id: 'ep-010',
      label: 'Profile Ten - EP-000010',
      description: 'ACTIVE',
      href: '/employment-profiles/ep-010',
    },
  ]),
}));

const renderWithProviders = (ui: JSX.Element) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

const findPicker = async (pickerId: string): Promise<HTMLElement> => {
  await waitFor(() => {
    expect(
      screen
        .getAllByTestId('picker-surface')
        .some((surface) => surface.getAttribute('data-picker-id') === pickerId),
    ).toBe(true);
  });
  const picker = screen
    .getAllByTestId('picker-surface')
    .find((surface) => surface.getAttribute('data-picker-id') === pickerId);
  if (!picker) {
    throw new Error(`Picker not found: ${pickerId}`);
  }
  return picker;
};

const selectPickerOption = async (
  user: ReturnType<typeof userEvent.setup>,
  pickerId: string,
  optionText: RegExp,
): Promise<void> => {
  const picker = await findPicker(pickerId);
  await user.click(await within(picker).findByText(optionText));
};

describe('talent wave 4 mutation payloads', () => {
  it('limits create-surface enum fields to the exact documented values', async () => {
    await setLocale(DEFAULT_LOCALE);
    const onSubmit = vi.fn();

    renderWithProviders(<TalentCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />);
    expect(screen.queryByLabelText(i18n.t('talent:fields.talentCode'))).toBeNull();
    expect(screen.getByText(i18n.t('talent:generatedCode.description'))).toBeInTheDocument();
    await within(await findPicker('talent-manager')).findByText(/EP-000001/);
    await within(await findPicker('talent-linked-employment-profile')).findByText(/EP-000010/);

    const originOptions = Array.from(
      screen.getByLabelText(i18n.t('talent:fields.talentOrigin')).querySelectorAll('option'),
    ).map((option) => option.getAttribute('value'));
    const commercialOptions = Array.from(
      screen
        .getByLabelText(i18n.t('talent:fields.commercialParticipationStatus'))
        .querySelectorAll('option'),
    ).map((option) => option.getAttribute('value'));

    expect(originOptions).toEqual(['', 'INTERNAL', 'EXTERNAL']);
    expect(commercialOptions).toEqual(['ALLOWED', 'BLOCKED']);
  });

  it('omits talentCode from the normal create payload while preserving external references', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(<TalentCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />);

    await user.selectOptions(
      screen.getByLabelText(i18n.t('talent:fields.talentOrigin')),
      'INTERNAL',
    );
    await user.type(screen.getByLabelText(i18n.t('talent:fields.stageName')), 'Generated Talent');
    await user.type(screen.getByLabelText(i18n.t('talent:fields.legalName')), 'Generated Legal');
    await user.type(screen.getByLabelText(i18n.t('talent:fields.externalRef')), 'EXT-TAL');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent:mutations.create.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        stageName: 'Generated Talent',
        externalRef: 'EXT-TAL',
      }),
    );
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('talentCode');
  });

  it('maps manager assignment blank input to an explicit null payload', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <TalentManagerAssignmentSurface
        currentTalentId="talent-001"
        currentManagerEmploymentProfileId="ep-001"
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: i18n.t('talent:actions.clearManager') }));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent:mutations.assignManager.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      newManagerEmploymentProfileId: null,
    });
  });

  it('submits the employment-profile link payload with the exact backend key', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <TalentEmploymentLinkSurface onCancel={() => undefined} onSubmit={onSubmit} />,
    );

    await selectPickerOption(user, 'talent-link-employment-profile', /EP-000010/);
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent:mutations.linkEmploymentProfile.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      linkedEmploymentProfileId: 'ep-010',
    });
  });

  it('submits the commercial participation payload with exact enum values and flags', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <TalentCommercialParticipationSurface
        initialValues={{
          commercialParticipationStatus: 'ALLOWED',
          livestreamEligible: true,
          eventEligible: true,
        }}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText(i18n.t('talent:fields.newCommercialParticipationStatus')),
      'BLOCKED',
    );
    await user.click(screen.getByLabelText(i18n.t('talent:fields.livestreamEligible')));
    await user.click(screen.getByLabelText(i18n.t('talent:fields.eventEligible')));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent:mutations.commercialParticipation.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      newCommercialParticipationStatus: 'BLOCKED',
      livestreamEligible: false,
      eventEligible: false,
    });
  });

  it('normalizes edit-surface cleared optional values to null instead of empty strings', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <TalentEditSurface
        initialValues={{
          stageName: 'Mina',
          legalName: 'Minh An',
          displayShortName: 'Mini',
          externalRef: 'EXT-01',
          profileSummary: 'Profile',
        }}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.clear(screen.getByLabelText(i18n.t('talent:fields.displayShortName')));
    await user.clear(screen.getByLabelText(i18n.t('talent:fields.externalRef')));
    await user.clear(screen.getByLabelText(i18n.t('talent:fields.profileSummary')));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent:mutations.edit.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      stageName: 'Mina',
      legalName: 'Minh An',
      displayShortName: null,
      externalRef: null,
      profileSummary: null,
    });
  });
});
