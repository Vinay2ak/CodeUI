import React from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  className?: string;
  isRowHeader?: boolean;
}

export interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  className?: string;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  caption,
  columns,
  data,
  keyExtractor,
  className = '',
  rowClassName,
  onRowClick,
}: DataTableProps<T>): JSX.Element {
  return (
    <div
      className={`overflow-x-auto w-full rounded-2xl border border-border bg-card ${className}`}
    >
      <Table className="w-full text-sm">
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader className="bg-secondary/60">
          <TableRow className="border-b border-border hover:bg-transparent">
            {columns.map((col, idx) => (
              <TableHead
                key={idx}
                scope="col"
                className={`px-4 py-3 text-xs font-semibold text-muted-foreground ${col.className || ''}`}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const extraClasses = rowClassName ? rowClassName(row) : '';
            return (
              <TableRow
                key={keyExtractor(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-border/70 last:border-0 hover:bg-secondary/40 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                } ${extraClasses}`}
              >
                {columns.map((col, idx) => {
                  const content =
                    typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : col.accessor
                      ? (row[col.accessor] as React.ReactNode)
                      : null;

                  if (col.isRowHeader) {
                    return (
                      <TableHead
                        key={idx}
                        scope="row"
                        className={`px-4 py-3.5 font-medium text-foreground whitespace-nowrap ${col.className || ''}`}
                      >
                        {content}
                      </TableHead>
                    );
                  }

                  return (
                    <TableCell
                      key={idx}
                      className={`px-4 py-3.5 text-muted-foreground whitespace-nowrap ${col.className || ''}`}
                    >
                      {content}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
