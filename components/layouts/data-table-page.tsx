"use client"

import { Suspense } from "react"
import { TableSkeleton } from "@/components/ui/data-table/table-skeleton"
import { DataTable } from "@/components/ui/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { DataTableError } from "@/components/ui/data-table/data-table-error"
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty"
import { useEffect, useState } from "react"

interface DataTablePageProps<TData, TValue> {
  // Basic props
  title: string
  description?: string
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  
  // Search and filtering
  searchKey?: string
  searchPlaceholder?: string
  filterableColumns?: {
    id: string
    title: string
    options: {
      label: string
      value: string
    }[]
  }[]

  // Loading and error states
  loading?: boolean
  error?: Error
  
  // Actions
  createAction?: () => void
  deleteAction?: (data: TData) => Promise<void>
  editAction?: (data: TData) => Promise<void>
  viewAction?: (data: TData) => void
  
  // Data fetching
  fetchData?: () => Promise<TData[]>
  refetchData?: () => Promise<void>
  
  // UI Customization
  className?: string
  headerMetrics?: React.ReactNode
  emptyState?: React.ReactNode
  customActions?: React.ReactNode
  
  // Table configuration
  pageSize?: number
  storageKey?: string
}

export function DataTablePage<TData, TValue>({
  // Destructure all props
  title,
  description,
  columns,
  data: initialData,
  searchKey,
  searchPlaceholder,
  filterableColumns,
  loading: externalLoading,
  error: externalError,
  createAction,
  deleteAction,
  editAction,
  viewAction,
  fetchData,
  refetchData,
  className,
  headerMetrics,
  emptyState,
  customActions,
  pageSize = 10,
  storageKey,
}: DataTablePageProps<TData, TValue>) {
  // Internal state management
  const [data, setData] = useState<TData[]>(initialData)
  const [loading, setLoading] = useState(externalLoading || false)
  const [error, setError] = useState<Error | undefined>(externalError)

  // Handle data fetching
  useEffect(() => {
    if (fetchData) {
      const loadData = async () => {
        try {
          setLoading(true)
          const newData = await fetchData()
          setData(newData)
          setError(undefined)
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Failed to fetch data'))
        } finally {
          setLoading(false)
        }
      }

      loadData()
    }
  }, [fetchData])

  // Handle data updates
  useEffect(() => {
    setData(initialData)
  }, [initialData])

  // Handle error reset
  const handleErrorReset = async () => {
    if (refetchData) {
      try {
        setLoading(true)
        await refetchData()
        setError(undefined)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch data'))
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className={cn("p-6 space-y-4", className)}>
      <div className="flex flex-col space-y-1">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {headerMetrics}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <Suspense fallback={<TableSkeleton />}>
        {error ? (
          <DataTableError error={error} reset={handleErrorReset} />
        ) : data.length === 0 && !loading ? (
          emptyState || (
            <DataTableEmpty 
              message="No results found" 
              createAction={createAction}
            />
          )
        ) : (
          <DataTable
            columns={columns}
            data={data}
            searchKey={searchKey}
            searchPlaceholder={searchPlaceholder}
            filterableColumns={filterableColumns}
            deleteAction={deleteAction}
            editAction={editAction}
            viewAction={viewAction}
            createAction={createAction}
            pageSize={pageSize}
            storageKey={storageKey}
            loadingState={loading ? <TableSkeleton /> : undefined}
          />
        )}
      </Suspense>

      {customActions}
    </div>
  )
} 