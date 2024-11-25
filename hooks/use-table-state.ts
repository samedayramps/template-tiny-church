"use client"

import { useState, useCallback, useEffect } from "react"
import { SortingState, VisibilityState, ColumnFiltersState } from "@tanstack/react-table"

interface UseTableStateProps {
  storageKey?: string
  initialState?: {
    sorting?: SortingState
    columnVisibility?: VisibilityState
    columnFilters?: ColumnFiltersState
  }
}

export function useTableState({ storageKey, initialState }: UseTableStateProps) {
  // Initialize state from localStorage or initial values
  const [sorting, setSorting] = useState<SortingState>(
    initialState?.sorting || []
  )
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialState?.columnVisibility || {}
  )
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    initialState?.columnFilters || []
  )

  // Load state from localStorage
  useEffect(() => {
    if (!storageKey) return

    const savedState = localStorage.getItem(storageKey)
    if (savedState) {
      const { sorting, columnVisibility, columnFilters } = JSON.parse(savedState)
      if (sorting) setSorting(sorting)
      if (columnVisibility) setColumnVisibility(columnVisibility)
      if (columnFilters) setColumnFilters(columnFilters)
    }
  }, [storageKey])

  // Save state to localStorage
  const saveState = useCallback(() => {
    if (!storageKey) return

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        sorting,
        columnVisibility,
        columnFilters,
      })
    )
  }, [storageKey, sorting, columnVisibility, columnFilters])

  useEffect(() => {
    saveState()
  }, [saveState])

  return {
    sorting,
    setSorting,
    columnVisibility,
    setColumnVisibility,
    columnFilters,
    setColumnFilters,
  }
} 