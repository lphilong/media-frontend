import i18n from 'i18next';
import { render, screen } from '@testing-library/react';

import { ErrorState } from '@shared/components/primitives/ErrorState';
import { PermissionDeniedState } from '@shared/components/primitives/PermissionDeniedState';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';

describe('operator-safe state feedback primitives', () => {
  it('renders a safe primary error message and keeps raw parse details collapsed', () => {
    render(
      <ErrorState
        title="Không tải được quyền theo nhân sự"
        message='[{"code":"unrecognized_keys","keys":["templateCode"],"path":["data","activeRoleAssignments",0]}]'
      />,
    );

    expect(
      screen.getByText(/Dữ liệu trả về chưa khớp với định dạng mà giao diện hiện tại hỗ trợ/u),
    ).toBeInTheDocument();
    expect(screen.getByText('Chi tiết kỹ thuật')).toBeInTheDocument();
    expect(screen.getByText(/templateCode/u).closest('details')).not.toBeNull();
  });

  it('renders honest Vietnamese denied guidance without specific requirements', async () => {
    await setLocale(DEFAULT_LOCALE);

    render(<PermissionDeniedState />);

    expect(screen.getByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(
      screen.getByText(/Tài khoản hiện tại chưa đáp ứng đủ điều kiện truy cập/u),
    ).toBeInTheDocument();
    expect(screen.getByText(/người phụ trách phân quyền/u)).toBeInTheDocument();
    expect(screen.queryByText(/Quyền:/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/Phạm vi:/u)).not.toBeInTheDocument();
  });

  it('renders source-backed denied requirements when provided', async () => {
    await setLocale(DEFAULT_LOCALE);

    render(
      <PermissionDeniedState
        reason="missing-scope"
        requiredPermissions={['event.read']}
        requiredScopes={['eventAssignment:global']}
        requiredAccountContext="ADMIN_CONSOLE"
      />,
    );

    expect(screen.getByText(/chưa có phạm vi dữ liệu phù hợp/u)).toBeInTheDocument();
    expect(screen.getByText(/Quyền thao tác: event.read/u)).toBeInTheDocument();
    expect(screen.getByText(/Phạm vi dữ liệu: eventAssignment:global/u)).toBeInTheDocument();
    expect(
      screen.getByText(/Điều kiện truy cập phù hợp cho chức năng này/u),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ADMIN_CONSOLE/u)).not.toBeInTheDocument();
  });

  it('renders honest Vietnamese copy when capability data cannot be loaded', async () => {
    await setLocale(DEFAULT_LOCALE);

    render(<PermissionDeniedState reason="missing-capabilities" />);

    expect(screen.getByText(/Không tải được dữ liệu quyền truy cập/u)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Hệ thống chưa tải được dữ liệu quyền hoặc năng lực truy cập cần thiết cho màn hình này/u,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Owner Admin/u)).not.toBeInTheDocument();
  });
});
