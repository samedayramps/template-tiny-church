import { ReactNode } from "react"
import { ColumnDef, Table, SortingState, VisibilityState, ColumnFiltersState } from "@tanstack/react-table"
import { z } from "zod"

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  
  // Search and filtering
  searchKey?: keyof TData
  searchPlaceholder?: string
  filterableColumns?: {
    id: string
    title: string
    options: {
      label: string
      value: string
    }[]
  }[]

  // Pagination
  pageSize?: number
  pageSizeOptions?: number[]
  
  // Actions and modals
  deleteAction?: (data: TData) => Promise<void>
  editAction?: (data: TData) => Promise<void>
  viewAction?: (data: TData) => void
  createAction?: () => void
  
  // Modal customization
  deleteModalTitle?: string
  deleteModalDescription?: string
  editModalTitle?: string
  editModalContent?: (item: TData) => ReactNode
  
  // Table state persistence
  storageKey?: string
  initialState?: {
    sorting?: SortingState
    columnVisibility?: VisibilityState
    columnFilters?: ColumnFiltersState
  }
  
  // Row selection
  enableRowSelection?: boolean
  onRowSelectionChange?: (selectedRows: TData[]) => void
  
  // Custom components
  renderCustomActions?: (data: TData) => React.ReactNode
  headerActions?: React.ReactNode
  emptyState?: React.ReactNode
  loadingState?: React.ReactNode
  
  // Add column visibility props
  columnVisibility?: Record<string, boolean>
  onColumnVisibilityChange?: (columnId: string, isVisible: boolean) => void
  onSearch?: (term: string) => void
}

export interface DataTablePaginationProps<TData> {
  table: Table<TData>
  pageSizeOptions?: number[]
}

// Add validation schemas
export const DataTableActionSchema = z.object({
  id: z.string(),
  action: z.enum(["edit", "delete", "view"])
})

export type DataTableAction = z.infer<typeof DataTableActionSchema> 

// Add a new interface for the error component
export interface DataTableErrorProps {
  error: Error
  reset: () => void
} 

export interface DataTablePageProps<TData, TValue> {
  // Basic props
  variant?: "full-page" | "embedded";
  title?: string;
  description?: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  fetchData?: () => Promise<TData[]>;
  searchKey?: keyof TData | string;
  searchPlaceholder?: string;
  headerMetrics?: React.ReactNode;
  createAction?: () => void;
  storageKey?: string;
  className?: string;

  // Table configuration
  pageSize?: number;
  filterableColumns?: {
    id: string;
    title: string;
    options: {
      label: string;
      value: string;
    }[];
  }[];

  // State props
  loading?: boolean;
  error?: Error;
  refetchData?: () => Promise<void>;

  // Custom components
  emptyState?: React.ReactNode;
  customActions?: React.ReactNode;

  // Action props
  deleteAction?: (item: TData) => Promise<void>;
  getItemDisplayName?: (item: TData) => string;
  deleteModalTitle?: string;
  deleteModalDescription?: (name: string) => string;
  editAction?: (item: TData) => Promise<void>;
  editModalTitle?: string;
  editModalContent?: (item: TData) => React.ReactNode;
  viewAction?: (item: TData) => void;
  viewModalTitle?: string;
  viewModalDescription?: (name: string) => string;
} 