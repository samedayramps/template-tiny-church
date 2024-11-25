"use client"

import { FileX } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DataTableEmptyProps {
  message?: string
  createAction?: () => void
}

export function DataTableEmpty({ 
  message = "No results found",
  createAction
}: DataTableEmptyProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <FileX className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{message}</h3>
      <p className="mb-4 mt-2 text-sm text-muted-foreground">
        We couldn't find any matching records.
      </p>
      {createAction && (
        <Button onClick={createAction} size="sm">
          Create New
        </Button>
      )}
    </div>
  )
} 