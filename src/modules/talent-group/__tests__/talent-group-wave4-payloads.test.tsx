import i18n from 'i18next';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiRequest } from '@shared/api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  TalentGroupAddMemberSurface,
  TalentGroupUpdateLineupSurface,
} from '@modules/talent-group/forms/talent-group-mutation-forms';
import { performTalentGroupMembershipLifecycleAction } from '@modules/talent-group/api/talent-group.api';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

const renderWithProviders = (ui: JSX.Element) => {
  return render(ui);
};

describe('talent-group wave 4 mutation payloads', () => {
  const mockedApiRequest = vi.mocked(apiRequest);

  afterEach(() => {
    mockedApiRequest.mockReset();
  });

  it('submits the add-member payload with exact talent and lineup fields', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <TalentGroupAddMemberSurface onCancel={() => undefined} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByLabelText(i18n.t('talent-group:fields.talentId')), 'talent-010');
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
