"use client"

import { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"
import { PlusCircle } from "lucide-react"

interface DataTableHeaderProps<TData> {
  table: Table<TData>
  title?: string
  description?: string
  createAction?: () => void
}

export function DataTableHeader<TData>({
  table,
  title,
  description,
  createAction,
}: DataTableHeaderProps<TData>) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        {title && <h2 className="text-2xl font-bold tracking-tight">{title}</h2>}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {createAction && (
          <Button onClick={createAction} size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New
          </Button>
        )}
      </div>
    </div>
  )
} 