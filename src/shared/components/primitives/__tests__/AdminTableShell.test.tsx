import { render, screen } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { beforeEach } from 'vitest';

import { AdminTableShell } from '@shared/components/primitives/AdminTableShell';
import { setLocale } from '@shared/i18n/i18n';

type Row = {
  id: string;
  name: string;
};

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => row.original.name,
  },
];

describe('AdminTableShell', () => {
  beforeEach(async () => {
    await setLocale('en');
  });

  it('renders title, toolbar, rows, and pagination through shared slots', () => {
    render(
      <AdminTableShell
        title="Operators"
        subtitle="Current result set"
        toolbar={<button type="button">Filter</button>}
        pagination={<div>Pager slot</div>}
        data={[{ id: '1', name: 'Lan Nguyen' }]}
        columns={columns}
        emptyTitle="No operators"
        emptyMessage="Try another filter."
        density="compact"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Operators' })).toBeInTheDocument();
    expect(screen.getByText('Current result set')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByText('Lan Nguyen')).toBeInTheDocument();
    expect(screen.getByText('Pager slot')).toBeInTheDocument();
  });

  it('renders shared loading, empty, and error states without requiring caller slots', () => {
    const { container, rerender } = render(
      <AdminTableShell
        data={[]}
        columns={columns}
        isLoading
        emptyTitle="No rows"
        emptyMessage="Nothing to show."
      />,
    );

    expect(container.querySelector('.animate-pulse')).not.toBeNull();

    rerender(
      <AdminTableShell
        data={[]}
        columns={columns}
        emptyTitle="No rows"
        emptyMessage="Nothing to show."
      />,
    );
    expect(screen.getByText('No rows')).toBeInTheDocument();
    expect(screen.getByText('Nothing to show.')).toBeInTheDocument();

    rerender(
      <AdminTableShell
        data={[]}
        columns={columns}
        isError
        emptyTitle="No rows"
        emptyMessage="Nothing to show."
      />,
    );
    expect(screen.getByText('Could not load data')).toBeInTheDocument();
  });
});
