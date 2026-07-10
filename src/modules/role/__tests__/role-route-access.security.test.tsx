import i18n from 'i18next';
import { screen } from '@testing-library/react';

import { canAccessModule, getModuleAccessReason } from '@app/router/module-access';
import { PERMISSIONS } from '@shared/auth/current-actor-capabilities';
import {
  expectNoRawAccountContextCodes,
  expectPermissionDeniedBusinessCopy,
} from '@test/assertions';
import { createActorCapabilities } from '@test/factories/access';
import { setupLocale } from '@test/locale-time';
import { renderRouteWithAccess } from '@test/render-app-route';
import { roleAdminCapabilities } from '@modules/role/__tests__/role-integration-test-helpers';

describe('Role route and access security', () => {
  it('requires backend Admin eligibility in addition to a Role capability', () => {
    const managerOnly = createActorCapabilities({
      accountContexts: ['MANAGER_CONSOLE'],
      permissions: [PERMISSIONS.ROLE_LIST],
    });

    expect(canAccessModule(managerOnly, 'role')).toBe(false);
    expect(getModuleAccessReason(managerOnly, 'role')).toBe('missing-account-context');
  });

  it('fails closed when Role permissions are absent', () => {
    const adminWithoutRolePermission = createActorCapabilities({
      accountContexts: ['ADMIN_CONSOLE'],
      permissions: [PERMISSIONS.USER_VIEW],
    });

    expect(canAccessModule(adminWithoutRolePermission, 'role')).toBe(false);
    expect(getModuleAccessReason(adminWithoutRolePermission, 'role')).toBe('missing-permission');
  });

  it('renders business-readable denial without protected Role controls or raw context codes', async () => {
    const restoreLocale = await setupLocale('en');
    const { unmount } = renderRouteWithAccess('/roles', {
      capabilities: createActorCapabilities({
        accountContexts: ['ADMIN_CONSOLE'],
        permissions: [PERMISSIONS.USER_VIEW],
      }),
    });

    try {
      expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
      expect(screen.queryByText(i18n.t('role:templateCatalog.title'))).not.toBeInTheDocument();
      expect(
        screen.queryByRole('tab', { name: i18n.t('role:tabs.assignments') }),
      ).not.toBeInTheDocument();
      expectPermissionDeniedBusinessCopy();
      expectNoRawAccountContextCodes();
    } finally {
      unmount();
      await restoreLocale();
    }
  });

  it('loads the Role module with explicit Admin eligibility and a Role permission', async () => {
    renderRouteWithAccess('/roles', { capabilities: roleAdminCapabilities });

    expect(
      await screen.findByRole('heading', { name: i18n.t('role:page.title') }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('tab', { name: i18n.t('role:tabs.templates') }),
    ).toBeInTheDocument();
  });
});
