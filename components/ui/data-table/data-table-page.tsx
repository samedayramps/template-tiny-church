"use client"

import * as React from "react"
import { Suspense, useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from 'next/navigation'
import { useToast } from "@/hooks/use-toast"
import { TableSkeleton } from "./table-skeleton"
import { DataTable } from "./data-table"
import { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { DataTableError } from "./data-table-error"
import { DataTableEmpty } from "./data-table-empty"
import { DataTableViewOptions } from "./data-table-view-options"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useDebouncedCallback } from 'use-debounce'
import { ReactNode } from "react"

interface DataTablePageProps<TData, TValue> {
  // Basic props
  variant?: "full-page" | "embedded"
  title?: string
  description?: string
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  fetchData?: () => Promise<TData[]>
  searchKey?: keyof TData | undefined
  searchPlaceholder?: string
  headerMetrics?: React.ReactNode
  createAction?: () => void
  storageKey?: string
  className?: string
  pageSize?: number

  // Table configuration
  filterableColumns?: {
    id: string
    title: string
    options: {
      label: string
      value: string
    }[]
  }[]

  // State props
  loading?: boolean
  error?: Error
  refetchData?: () => Promise<void>

  // Custom components
  emptyState?: React.ReactNode
  customActions?: React.ReactNode

  // Action props
  deleteAction?: (item: TData) => Promise<void>
  getItemDisplayName?: (item: TData) => string
  deleteModalTitle?: string
  deleteModalDescription?: (name: string) => string
  editAction?: (item: TData) => Promise<void>
  editModalTitle?: string
  editModalContent?: (item: TData) => React.ReactNode
  viewAction?: (item: TData) => void
  viewModalTitle?: string
  viewModalDescription?: (name: string) => string
}

export function DataTablePage<TData extends { id: string }, TValue>({
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
  deleteModalTitle = "Delete Item",
  deleteModalDescription = (name) => `Are you sure you want to delete ${name}? This action cannot be undone.`,
  getItemDisplayName = (item: TData) => item.id,
  variant = "embedded",
  editModalTitle,
  editModalContent
}: DataTablePageProps<TData, TValue>) {
  // Memoized initial state
  const initialState = useMemo(() => ({
    data: initialData,
    loading: externalLoading || false,
    error: externalError,
    columnVisibility: {},
  }), [initialData, externalLoading, externalError])

  // State management with proper typing
  const [state, setState] = useState(initialState)
  const [itemToDelete, setItemToDelete] = useState<TData | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Memoized filtered data
  const filteredData = useMemo(() => {
    if (!searchTerm || !searchKey) return state.data

    return state.data.filter((item: any) => {
      const value = item[searchKey]
      if (!value) return false

      // Handle different data types
      if (typeof value === 'number') {
        return value.toString().includes(searchTerm.toLowerCase())
      }
      
      if (typeof value === 'boolean') {
        return value.toString() === searchTerm.toLowerCase()
      }
      
      if (typeof value === 'object') {
        return JSON.stringify(value).toLowerCase().includes(searchTerm.toLowerCase())
      }
      
      return value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    })
  }, [state.data, searchTerm, searchKey])

  // Debounced search handler
  const handleSearch = useDebouncedCallback((term: string) => {
    if (!searchKey) return;
    setSearchTerm(term.toLowerCase())
  }, 300)

  // Memoized handlers
  const handleReset = useCallback(() => {
    if (fetchData) {
      void fetchData()
    }
  }, [fetchData])

  const handleDelete = useCallback(async (item: TData) => {
    if (deleteAction) {
      try {
        await deleteAction(item)
        setState(prev => ({
          ...prev,
          data: prev.data.filter(d => d.id !== item.id)
        }))
        toast({
          title: "Success",
          description: "Item deleted successfully"
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete item",
          variant: "destructive"
        })
      }
    }
  }, [deleteAction, toast])

  const handleColumnVisibilityChange = useCallback((id: string, value: boolean) => {
    setState(prev => ({
      ...prev,
      columnVisibility: { ...prev.columnVisibility, [id]: value }
    }))
  }, [])

  // Effect for URL parameters
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    
    if (success || error) {
      toast({
        title: success ? "Success" : "Error",
        description: decodeURIComponent(success || error || ""),
        variant: error ? "destructive" : "default"
      })
    }
  }, [searchParams, toast])

  // Effect for data fetching
  useEffect(() => {
    if (fetchData) {
      const loadData = async () => {
        setState(prev => ({ ...prev, loading: true }))
        try {
          const newData = await fetchData()
          setState(prev => ({
            ...prev,
            data: newData,
            error: undefined,
            loading: false
          }))
        } catch (err) {
          setState(prev => ({
            ...prev,
            error: err instanceof Error ? err : new Error('Failed to fetch data'),
            loading: false
          }))
        }
      }
      void loadData()
    }
  }, [fetchData])

  // Memoized table content
  const tableContent = useMemo(() => (
    <div className={cn("space-y-6", className)}>
      {/* Header Section */}
      <div className="border-b">
        <div className="space-y-1 pb-4">
          <h2 className={cn(
            "font-bold tracking-tight",
            variant === 'full-page' ? "text-3xl" : "text-2xl"
          )}>{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {headerMetrics}
          {searchKey && (
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="max-w-sm"
            />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {createAction && (
            <Button 
              onClick={createAction}
              size="sm"
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </Button>
          )}
          <DataTableViewOptions
            columns={columns}
            columnVisibility={state.columnVisibility}
            onToggleVisibility={handleColumnVisibilityChange}
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-md">
        <Suspense fallback={<TableSkeleton />}>
          {state.error ? (
            <DataTableError error={state.error} reset={handleReset} />
          ) : filteredData.length === 0 && !state.loading ? (
            emptyState || (
              <DataTableEmpty 
                message={searchTerm ? "No matching results" : "No results found"}
                createAction={createAction}
              />
            )
          ) : (
            <DataTable
              columns={columns}
              data={filteredData}
              searchKey={searchKey}
              searchPlaceholder={searchPlaceholder}
              filterableColumns={filterableColumns}
              deleteAction={handleDelete}
              editAction={async (item: TData) => {
                if (editAction) {
                  await editAction(item);
                }
              }}
              viewAction={viewAction}
              createAction={createAction}
              loadingState={state.loading ? <TableSkeleton /> : undefined}
              columnVisibility={state.columnVisibility}
              onColumnVisibilityChange={handleColumnVisibilityChange}
              editModalTitle={editModalTitle}
              editModalContent={editModalContent}
            />
          )}
        </Suspense>
      </div>

      {customActions}
    </div>
  ), [
    state,
    filteredData,
    searchTerm,
    columns,
    handleSearch,
    handleDelete,
    handleColumnVisibilityChange,
    // ... other dependencies
  ])

  return (
    <>
      {variant === 'full-page' ? (
        <div className="flex-1 space-y-4 p-8">
          {tableContent}
        </div>
      ) : (
        tableContent
      )}

      <AlertDialog 
        open={!!itemToDelete} 
        onOpenChange={(open) => !open && setItemToDelete(null)}
      >
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">
              {deleteModalTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {itemToDelete && deleteModalDescription(getItemDisplayName(itemToDelete))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center space-x-2">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                if (itemToDelete) {
                  void handleDelete(itemToDelete);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 