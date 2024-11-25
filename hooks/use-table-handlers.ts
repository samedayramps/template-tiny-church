"use client"

import { useCallback, useTransition } from "react"
import { toast } from "@/hooks/use-toast"

export function useTableHandlers<TData>() {
  const [isPending, startTransition] = useTransition()

  const handleEdit = useCallback((
    item: TData, 
    editAction?: (data: TData) => Promise<void>
  ) => {
    if (!editAction) return

    startTransition(async () => {
      try {
        await editAction(item)
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
    })
  }, [])

  const handleDelete = useCallback((
    item: TData, 
    deleteAction?: (data: TData) => Promise<void>
  ) => {
    if (!deleteAction) return

    startTransition(async () => {
      try {
        await deleteAction(item)
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
    })
  }, [])

  return {
    handleEdit,
    handleDelete,
    isPending
  }
} 