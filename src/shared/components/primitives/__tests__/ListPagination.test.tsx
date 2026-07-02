import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';

import { ListPagination } from '@shared/components/primitives/ListPagination';
import { setLocale } from '@shared/i18n/i18n';

describe('ListPagination', () => {
  beforeEach(async () => {
    await setLocale('vi');
  });

  it('renders page mode with page totals and jump controls', async () => {
    const user = userEvent.setup();
    const onGoToPage = vi.fn();

    render(
      <ListPagination
        mode="page"
        currentPage={2}
        totalPages={10}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onGoToPage={onGoToPage}
      />,
    );

    expect(screen.getByText('Trang 2 / 10')).toBeInTheDocument();
    expect(screen.getByLabelText('Đi tới trang')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Đi tới trang'), '6');
    await user.click(screen.getByRole('button', { name: 'Tới' }));

    expect(onGoToPage).toHaveBeenCalledWith(6);
  });

  it('renders cursor mode with bounded disclosure and no jump controls', () => {
    render(
      <ListPagination
        mode="cursor"
        canGoBack={false}
        canGoNext
        limit={20}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Đang hiển thị tối đa 20 dòng')).toBeInTheDocument();
    expect(
      screen.getByText('Danh sách tải dữ liệu theo từng lượt và không hiển thị tổng số trang.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Trang 1 \//u)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')[0]).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByLabelText('Đi tới trang')).not.toBeInTheDocument();
  });
});
