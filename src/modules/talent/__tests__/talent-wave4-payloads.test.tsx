import i18n from 'i18next';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  TalentCommercialParticipationSurface,
  TalentCreateSurface,
  TalentEditSurface,
  TalentEmploymentLinkSurface,
  TalentManagerAssignmentSurface,
} from '@modules/talent/forms/talent-mutation-forms';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';

const renderWithProviders = (ui: JSX.Element) => {
  return render(ui);
};

describe('talent wave 4 mutation payloads', () => {
  it('limits create-surface enum fields to the exact documented values', async () => {
    await setLocale(DEFAULT_LOCALE);
    const onSubmit = vi.fn();

    renderWithProviders(<TalentCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />);

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

    const managerField = screen.getByLabelText(
      i18n.t('talent:fields.newManagerEmploymentProfileId'),
    );
    await user.clear(managerField);
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

    await user.type(
      screen.getByLabelText(i18n.t('talent:fields.linkedEmploymentProfileId')),
      'ep-010',
    );
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
