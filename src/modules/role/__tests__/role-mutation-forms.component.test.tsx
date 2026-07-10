import i18n from 'i18next';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RoleCreateSurface, RoleEditSurface } from '@modules/role/forms/role-mutation-forms';
import {
  roleDetailFixture,
  roleTemplateCatalogFixture,
  roleTemplatePreviewFixture,
} from '@modules/role/__tests__/role-test-fixtures';
import { DEFAULT_LOCALE } from '@shared/i18n/i18n';
import { setupLocale } from '@test/locale-time';

describe('Role mutation form components', () => {
  it('submits supported template-create and update payloads without raw permission keys', async () => {
    const restoreLocale = await setupLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onCreateFromTemplate = vi.fn();
    const onUpdate = vi.fn();

    try {
      const createRender = render(
        <RoleCreateSurface
          onCancel={() => undefined}
          onTemplateSubmit={onCreateFromTemplate}
          onPreviewTemplate={vi.fn(async () => roleTemplatePreviewFixture)}
          templateCatalog={roleTemplateCatalogFixture}
        />,
      );

      expect(screen.queryByLabelText(i18n.t('role:templates.customMode'))).not.toBeInTheDocument();
      await user.selectOptions(
        screen.getByRole('combobox', { name: i18n.t('role:templates.roleTemplate') }),
        'TALENT_GROUP_MANAGER',
      );
      expect(screen.getByText(i18n.t('role:generatedCode.description'))).toBeInTheDocument();
      expect(
        await screen.findByText(i18n.t('role:templates.generatedPermissions')),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          i18n.t('role:permissionGroups.summaryItem', {
            group: i18n.t('role:permissionGroups.workSchedule'),
            count: 1,
          }),
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText('workSchedule.read')).not.toBeInTheDocument();
      expect(screen.getByText('Scope plans are preview-only.')).toBeInTheDocument();
      expect(screen.getByText(/Preview-only scope plan/u)).toBeInTheDocument();

      await user.type(screen.getByLabelText(i18n.t('role:fields.name')), 'Team Manager Copy');
      await user.click(
        screen.getByRole('button', { name: i18n.t('role:mutations.create.submit') }),
      );
      expect(onCreateFromTemplate).toHaveBeenCalledWith({
        templateCode: 'TALENT_GROUP_MANAGER',
        name: 'Team Manager Copy',
        description: null,
      });
      createRender.unmount();

      const editRender = render(
        <RoleEditSurface
          initialRecord={roleDetailFixture}
          onCancel={() => undefined}
          onSubmit={onUpdate}
        />,
      );
      await user.clear(
        within(editRender.container).getByLabelText(i18n.t('role:fields.description')),
      );
      await user.click(
        within(editRender.container).getByRole('button', {
          name: i18n.t('role:mutations.update.submit'),
        }),
      );
      expect(onUpdate).toHaveBeenCalledWith({
        name: 'Admin role',
        description: null,
        delegationBand: 'PRIVILEGED',
        maxDelegatableBand: 'LIMITED',
      });
      editRender.unmount();
    } finally {
      await restoreLocale();
    }
  });
});
