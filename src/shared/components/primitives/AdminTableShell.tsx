import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table';

import { EmptyState } from '@shared/components/primitives/EmptyState';
import { LoadingState } from '@shared/components/primitives/LoadingState';

type AdminTableShellProps<TData extends RowData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  isLoading?: boolean;
  emptyTitle: string;
  emptyMessage: string;
  caption?: string;
  onRowClick?: (row: TData) => void;
};

export const AdminTableShell = <TData extends RowData>({
  data,
  columns,
  isLoading,
  emptyTitle,
  emptyMessage,
  caption,
  onRowClick,
}: AdminTableShellProps<TData>): JSX.Element => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <LoadingState lines={8} />;
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel shadow-shell">
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-slate-100 text-left">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2 font-semibold text-text">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`border-t border-border ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 text-text">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
