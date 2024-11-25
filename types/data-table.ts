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