"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { Button } from "./button";
import { Pagination } from "./pagination";

// ============================================
// 表格组件 - 基于 TanStack Table 风格
// ============================================

interface Column<T> {
  key: string;
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  sortConfig?: {
    key: string;
    direction: "asc" | "desc";
  } | null | undefined;
  onSort?: (key: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  sortConfig,
  onSort,
  isLoading,
  emptyMessage = "暂无数据",
}: DataTableProps<T>) {
  const sortedData = React.useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof T];
      const bVal = b[sortConfig.key as keyof T];

      if (aVal === bVal) return 0;

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-12 border-b border-gray-100 last:border-0"
            >
              <div className="h-full w-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
        <p className="text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-4 py-3 text-left text-sm font-medium text-gray-600",
                  column.sortable && "cursor-pointer hover:bg-gray-100 transition-colors",
                  column.className
                )}
                onClick={() => column.sortable && onSort?.(column.key)}
              >
                <div className="flex items-center gap-2">
                  {column.header}
                  {column.sortable && (
                    <span className="inline-block">
                      {sortConfig?.key === column.key ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="h-4 w-4 text-gray-300" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <tr
              key={keyExtractor(row)}
              className={cn(
                "border-b border-gray-100 last:border-0",
                "hover:bg-gray-50 transition-colors",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <td
                  key={`${keyExtractor(row)}-${column.key}`}
                  className={cn("px-4 py-3 text-sm text-gray-700", column.className)}
                >
                  {typeof column.accessor === "function"
                    ? column.accessor(row)
                    : (row[column.accessor] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// 表格工具栏组件
// ============================================

interface TableToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function TableToolbar({ children, className }: TableToolbarProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row gap-4 mb-4", className)}>
      {children}
    </div>
  );
}

interface TableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function TableSearch({
  value,
  onChange,
  placeholder = "搜索...",
  className,
}: TableSearchProps) {
  return (
    <div className={cn("relative flex-1 max-w-md", className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full h-10 pl-10 pr-4 rounded-lg border border-gray-300",
          "text-sm placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        )}
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  );
}

interface TableFiltersProps {
  children: React.ReactNode;
  className?: string;
}

export function TableFilters({ children, className }: TableFiltersProps) {
  return (
    <div className={cn("flex flex-wrap gap-2 items-center", className)}>
      {children}
    </div>
  );
}

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 mt-4", className)}>
      <span className="text-sm text-gray-500">
        显示 {start}-{end} 条，共 {totalCount} 条
      </span>

      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={cn(
              "h-8 rounded-md border border-gray-300 px-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500"
            )}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                每页 {size} 条
              </option>
            ))}
          </select>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
