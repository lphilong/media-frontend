import i18n from 'i18next';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { apiRequest } from '@shared/api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  TalentGroupAddMemberSurface,
  TalentGroupCreateSurface,
  TalentGroupUpdateLineupSurface,
} from '@modules/talent-group/forms/talent-group-mutation-forms';
import { performTalentGroupMembershipLifecycleAction } from '@modules/talent-group/api/talent-group.api';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@shared/components/reference/admin-reference-options', () => ({
  loadTalentReferenceOptions: vi.fn(async () => [
    {
      id: 'talent-010',
      label: 'Talent Ten - TAL-000010',
      description: 'ACTIVE',
      href: '/talents/talent-010',
    },
  ]),
}));

const renderWithProviders = (ui: JSX.Element) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

const selectPickerOption = async (
  user: ReturnType<typeof userEvent.setup>,
  pickerId: string,
  optionText: RegExp,
): Promise<void> => {
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
  await user.click(await within(picker).findByText(optionText));
};

describe('talent-group wave 4 mutation payloads', () => {
  const mockedApiRequest = vi.mocked(apiRequest);

  afterEach(() => {
    mockedApiRequest.mockReset();
  });

  it('omits groupCode from the normal create payload while preserving external references', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <TalentGroupCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />,
    );

    expect(screen.queryByLabelText(i18n.t('talent-group:fields.groupCode'))).toBeNull();
    expect(screen.getByText(i18n.t('talent-group:generatedCode.description'))).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('talent-group:fields.name')), 'Generated Group');
    await user.type(screen.getByLabelText(i18n.t('talent-group:fields.externalRef')), 'EXT-GROUP');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent-group:mutations.create.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Generated Group',
        externalRef: 'EXT-GROUP',
      }),
    );
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('groupCode');
  });

  it('submits the add-member payload with exact talent and lineup fields', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <TalentGroupAddMemberSurface onCancel={() => undefined} onSubmit={onSubmit} />,
    );

    await selectPickerOption(user, 'talent-group-member-talent', /TAL-000010/);
    await user.clear(screen.getByLabelText(i18n.t('talent-group:fields.lineupOrder')));
    await user.type(screen.getByLabelText(i18n.t('talent-group:fields.lineupOrder')), '4');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent-group:mutations.addMember.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      talentId: 'talent-010',
      lineupOrder: 4,
    });
  });

  it('submits the lineup update payload with the exact backend field name', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <TalentGroupUpdateLineupSurface
        initialLineupOrder={2}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.clear(screen.getByLabelText(i18n.t('talent-group:fields.newLineupOrder')));
    await user.type(screen.getByLabelText(i18n.t('talent-group:fields.newLineupOrder')), '7');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent-group:mutations.updateLineup.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      newLineupOrder: 7,
    });
  });

  it('sends the membership remove lifecycle path with an exact zero-body payload', async () => {
    mockedApiRequest.mockResolvedValue({
      data: {
        id: 'membership-001',
        groupId: 'group-001',
        talentId: 'talent-001',
        membershipStatus: 'REMOVED',
        lineupOrder: 1,
        joinedAt: 1_000,
        leftAt: 2_000,
        createdAt: 1_000,
        updatedAt: 2_000,
      },
    });

    await performTalentGroupMembershipLifecycleAction('membership-001', 'remove');

    expect(mockedApiRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/admin/talent-groups/members/membership-001/remove',
      data: {},
    });
  });
});
