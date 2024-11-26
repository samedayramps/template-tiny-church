"use client"

import * as React from "react"
import { useCallback, useMemo, useState } from "react"
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
  OnChangeFn,
} from "@tanstack/react-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Suspense } from "react"
import { Pencil, Eye, Trash2 } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTablePagination } from "./data-table-pagination"
import { DataTableProps } from "@/types/data-table"
import { TableSkeleton } from "./table-skeleton"
import { cn } from "@/lib/utils"

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
  editModalContent,
  loadingState,
  columnVisibility,
  onColumnVisibilityChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState({})
  const [selectedItem, setSelectedItem] = useState<TData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [localColumnVisibility, setLocalColumnVisibility] = useState<VisibilityState>(
    columnVisibility || {}
  )

  // Handle column visibility changes
  const handleColumnVisibilityChange: OnChangeFn<VisibilityState> = useCallback(
    (updater) => {
      const newVisibility = typeof updater === 'function'
        ? updater(localColumnVisibility)
        : updater

      setLocalColumnVisibility(newVisibility)
      
      if (onColumnVisibilityChange) {
        Object.entries(newVisibility).forEach(([columnId, isVisible]) => {
          if (typeof isVisible === 'boolean') {
            onColumnVisibilityChange(columnId, isVisible)
          }
        })
      }
    },
    [localColumnVisibility, onColumnVisibilityChange]
  )

  // Move the columnsWithActions declaration before the table configuration
  const columnsWithActions = useMemo(() => {
    if (editAction || deleteAction || viewAction) {
      return [
        ...columns,
        {
          id: "actions",
          cell: ({ row }) => {
            const item = row.original
            return (
              <div className="flex items-center justify-end gap-2">
                {editAction && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedItem(item)
                      setIsEditing(true)
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {viewAction && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => viewAction(item)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                {deleteAction && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedItem(item)
                      setIsDeleting(true)
                    }}
                    className="h-8 w-8 p-0 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )
          }
        }
      ]
    }
    return columns
  }, [columns, editAction, deleteAction, viewAction])

  const table = useReactTable({
    data,
    columns: columnsWithActions,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility: localColumnVisibility,
      rowSelection,
    },
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

  const handleEdit = async (item: TData) => {
    if (editAction) {
      try {
        await Promise.resolve(editAction(item));
        setIsEditing(false);
        toast({
          title: "Success",
          description: "Item updated successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update item",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      <Suspense fallback={loadingState || <TableSkeleton />}>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-10 px-2 text-xs">
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
            
            {/* Render the edit form content */}
            {selectedItem && editModalContent ? (
              editModalContent(selectedItem)
            ) : (
              <div className="flex justify-end gap-2 py-3">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={async () => {
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
                }}>
                  Save Changes
                </Button>
              </div>
            )}
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