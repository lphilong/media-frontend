import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@shared/components/primitives/EmptyState';
import { ErrorState } from '@shared/components/primitives/ErrorState';
import { LoadingState } from '@shared/components/primitives/LoadingState';

type AdminTableShellProps<TData extends RowData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  isLoading?: boolean;
  isError?: boolean;
  emptyTitle: string;
  emptyMessage: string;
  errorTitle?: string;
  errorMessage?: string;
  title?: string;
  subtitle?: string;
  toolbar?: ReactNode;
  pagination?: ReactNode;
  loadingState?: ReactNode;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  density?: 'comfortable' | 'compact';
  caption?: string;
  onRowClick?: (row: TData) => void;
};

export const AdminTableShell = <TData extends RowData>({
  data,
  columns,
  isLoading,
  isError,
  emptyTitle,
  emptyMessage,
  errorTitle,
  errorMessage,
  title,
  subtitle,
  toolbar,
  pagination,
  loadingState,
  emptyState,
  errorState,
  density = 'comfortable',
  caption,
  onRowClick,
}: AdminTableShellProps<TData>): JSX.Element => {
  const { t } = useTranslation('common');
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const cellPaddingClass = density === 'compact' ? 'px-3 py-1.5' : 'px-3 py-2';

  const renderChrome = (content: ReactNode): JSX.Element => (
    <div className="space-y-3">
      {title || subtitle || toolbar ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          {title || subtitle ? (
            <div className="min-w-0">
              {title ? <h2 className="text-base font-semibold text-text">{title}</h2> : null}
              {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
            </div>
          ) : null}
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}
      {content}
      {pagination ? <div className="flex justify-end">{pagination}</div> : null}
    </div>
  );

  if (isLoading) {
    return renderChrome(loadingState ?? <LoadingState lines={8} variant="table" />);
  }

  if (isError) {
    return renderChrome(
      errorState ?? (
        <ErrorState
          title={errorTitle ?? t('semanticStates.service-error.title')}
          message={errorMessage ?? t('semanticStates.service-error.message')}
          variant="inline"
        />
      ),
    );
  }

  if (data.length === 0) {
    return renderChrome(
      emptyState ?? <EmptyState title={emptyTitle} message={emptyMessage} variant="inline" />,
    );
  }

  return renderChrome(
    <div className="overflow-hidden rounded-lg border border-border bg-panel shadow-shell">
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-slate-100 text-left">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={`${cellPaddingClass} font-semibold text-text`}>
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
                  <td key={cell.id} className={`${cellPaddingClass} text-text`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>,
  );
};
