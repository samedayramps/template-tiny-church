"use client"

import * as React from "react"
import { useCallback, useMemo } from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Suspense } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTableToolbar } from "./data-table-toolbar"
import { DataTablePagination } from "./data-table-pagination"
import { DataTableProps } from "@/types/data-table"
import { TableSkeleton } from "./table-skeleton"

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Filter...",
  pageSize = 10,
  pageSizeOptions = [10, 20, 30, 40, 50],
  deleteAction,
  editAction,
  viewAction,
  deleteModalTitle = "Are you absolutely sure?",
  deleteModalDescription = "This action cannot be undone.",
  editModalTitle = "Edit Item",
  loadingState,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [isEditing, setIsEditing] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [selectedItem, setSelectedItem] = React.useState<TData | null>(null)

  // Memoized handlers
  const handleEdit = useCallback((item: TData) => {
    setSelectedItem(item)
    setIsEditing(true)
  }, [])

  const handleDelete = useCallback((item: TData) => {
    setSelectedItem(item)
    setIsDeleting(true)
  }, [])

  const handleView = useCallback((item: TData) => {
    if (viewAction) {
      viewAction(item)
    }
  }, [viewAction])

  // Memoize core table functions
  const getCoreRowModelMemo = useCallback(getCoreRowModel(), [])
  const getFilteredRowModelMemo = useCallback(getFilteredRowModel(), [])
  const getPaginationRowModelMemo = useCallback(getPaginationRowModel(), [])
  const getSortedRowModelMemo = useCallback(getSortedRowModel(), [])

  // Memoize table state
  const tableState = useMemo(
    () => ({
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    }),
    [sorting, columnFilters, columnVisibility, rowSelection]
  )

  // Create table instance with proper typing
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(data.length / pageSize),
    state: tableState,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModelMemo,
    getFilteredRowModel: getFilteredRowModelMemo,
    getPaginationRowModel: getPaginationRowModelMemo,
    getSortedRowModel: getSortedRowModelMemo,
  })

  // Memoize row rendering function
  const renderRows = useCallback(
    () => (
      <TableBody>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext()
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center"
            >
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    ),
    [table, columns]
  )

  return (
    <div className="space-y-4">
      <DataTableToolbar<TData>
        table={table}
        searchKey={searchKey}
        searchPlaceholder={searchPlaceholder}
      />
      <Suspense fallback={loadingState || <TableSkeleton />}>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            {renderRows()}
          </Table>
        </div>
      </Suspense>
      <DataTablePagination<TData> table={table} />

      {editAction && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editModalTitle}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-end gap-2 py-3">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedItem || !editAction) return
                  try {
                    await editAction(selectedItem)
                    setIsEditing(false)
                    toast({
                      title: "Success",
                      description: "Item updated successfully",
                    })
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to update item",
                      variant: "destructive",
                    })
                  }
                }}
              >
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {deleteAction && (
        <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteModalTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteModalDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!selectedItem || !deleteAction) return
                  try {
                    await deleteAction(selectedItem)
                    setIsDeleting(false)
                    toast({
                      title: "Success",
                      description: "Item deleted successfully",
                    })
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to delete item",
                      variant: "destructive",
                    })
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
} 