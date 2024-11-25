"use client"

import { useCallback } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { X, PlusCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTableViewOptions } from "./data-table-view-options"
import { DataTableToolbarProps } from "@/types/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder,
  filterableColumns,
  headerActions,
  createAction
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  const handleSearch = useDebouncedCallback((value: string) => {
    if (searchKey) {
      table.getColumn(searchKey)?.setFilterValue(value)
    }
  }, 300)

  const resetFilters = useCallback(() => {
    table.resetColumnFilters()
  }, [table])

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-1 items-center space-x-2">
          {searchKey && (
            <div className="relative w-full md:w-[250px]">
              <Input
                placeholder={searchPlaceholder}
                onChange={(event) => handleSearch(event.target.value)}
                className="h-9 w-full"
              />
              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={resetFilters}
                  className="absolute right-0 top-0 h-9 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {filterableColumns?.map(({ id, title, options }) => (
              <Select
                key={id}
                onValueChange={(value) => {
                  table.getColumn(id)?.setFilterValue(value)
                }}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder={title} />
                </SelectTrigger>
                <SelectContent>
                  {options.map(({ label, value }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {createAction && (
            <Button 
              onClick={createAction}
              className="h-9"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New
            </Button>
          )}
          {headerActions}
          <DataTableViewOptions table={table} />
        </div>
      </div>
    </div>
  )
} 