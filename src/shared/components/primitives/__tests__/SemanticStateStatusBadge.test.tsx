import { render, screen } from '@testing-library/react';
import { beforeEach } from 'vitest';

import { SemanticState, StatusBadge } from '@shared/components/primitives';
import { setLocale } from '@shared/i18n/i18n';

describe('semantic UI primitives', () => {
  beforeEach(async () => {
    await setLocale('vi');
  });

  it('distinguishes no data, no matching filters, and no permission states', () => {
    const { rerender } = render(<SemanticState kind="no-data" />);

    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();

    rerender(<SemanticState kind="no-matching-filters" />);
    expect(screen.getByText('Không có dòng nào khớp bộ lọc')).toBeInTheDocument();

    rerender(<SemanticState kind="no-permission" />);
    expect(screen.getByText('Bạn không có quyền xem dữ liệu này')).toBeInTheDocument();
  });

  it('maps semantic badge families to accessible labelled status chips', () => {
    render(<StatusBadge family="severity" status="BLOCKER" label="Cần xử lý gấp" />);

    const badge = screen.getByLabelText('Cần xử lý gấp');
    expect(badge).toHaveTextContent('Cần xử lý gấp');
    expect(badge).toHaveClass('bg-rose-100');
  });

  it('supports caller-provided operator labels while keeping raw status fallback safe', () => {
    const { rerender } = render(
      <StatusBadge
        family="workflow"
        status="PENDING_APPROVAL"
        labelByStatus={{ PENDING_APPROVAL: 'Cho duyet' }}
      />,
    );

    expect(screen.getByLabelText('Cho duyet')).toHaveTextContent('Cho duyet');

    rerender(<StatusBadge family="workflow" status="UNKNOWN_STATUS" />);
    expect(screen.getByLabelText('UNKNOWN_STATUS')).toHaveTextContent('UNKNOWN_STATUS');
  });
});
