"use client"

import { ColumnDef } from "@tanstack/react-table"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Settings2 } from "lucide-react"

interface DataTableViewOptionsProps<TData> {
  columns: ColumnDef<TData, any>[];
  columnVisibility: Record<string, boolean>;
  onToggleVisibility: (columnId: string, isVisible: boolean) => void;
}

export function DataTableViewOptions<TData>({
  columns = [],
  columnVisibility = {},
  onToggleVisibility,
}: DataTableViewOptionsProps<TData>) {
  if (!columns || !Array.isArray(columns)) {
    return null;
  }

  const visibleColumns = columns.filter(column => 
    'id' in column && 
    typeof column.id === 'string' &&
    !column.id.match(/^(select|actions)$/i)
  );

  if (visibleColumns.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-8 lg:flex"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        {visibleColumns.map((column) => {
          const columnId = column.id as string;
          return (
            <DropdownMenuCheckboxItem
              key={columnId}
              className="capitalize"
              checked={columnVisibility[columnId] ?? true}
              onCheckedChange={(checked) => onToggleVisibility(columnId, checked)}
            >
              {columnId.replace(/_/g, ' ')}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 