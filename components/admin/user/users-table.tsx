"use client"

import { useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Building, Pencil, Eye, Trash2 } from "lucide-react"
import { UserRoleWithAuth } from "@/lib/data/supabase/types"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header"
import { impersonateUser } from "@/actions/admin"
import { useTableHandlers } from "@/hooks/use-table-handlers"

// Create a function to generate columns
export function createUserColumns(): ColumnDef<UserRoleWithAuth>[] {
  return [
    {
      id: "email",
      accessorFn: (row) => row.email,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
    },
    {
      id: "role",
      accessorFn: (row) => row.role,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
    },
    {
      id: "tenant",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tenant" />
      ),
      cell: ({ row }) => {
        const tenant = row.original.metadata?.tenant_name || 'No Tenant'
        return (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            <span>{tenant}</span>
          </div>
        )
      },
    },
  ]
}

export function UsersDataTable({ data }: { data: UserRoleWithAuth[] }) {
  const columns = useMemo(() => createUserColumns(), [])
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="email"
      searchPlaceholder="Filter emails..."
      pageSize={10}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={(columnId, isVisible) => {
        setColumnVisibility(prev => ({
          ...prev,
          [columnId]: isVisible
        }))
      }}
      deleteAction={async (user) => {
        // Implement your delete logic here
        console.log("Deleting user:", user)
      }}
      editAction={async (user) => {
        // Implement your edit logic here
        console.log("Editing user:", user)
      }}
      viewAction={(user) => {
        // View user logic
        console.log("View user:", user)
      }}
      deleteModalTitle="Delete User"
      deleteModalDescription="This will permanently delete the user account and remove their data from our servers."
      editModalTitle="Edit User"
    />
  )
}

// Export the column generator function instead of the columns directly
export { createUserColumns as userTableColumns }