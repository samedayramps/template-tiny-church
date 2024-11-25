"use client"

import { useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Users, Pencil, Eye, Trash2, Loader2 } from "lucide-react"
import { DataTable } from "@/components/ui/data-table/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { useTableHandlers } from "@/hooks/use-table-handlers"
import { useTableState } from "@/hooks/use-table-state"

interface TenantData {
  id: string
  tenant_id: string
  tenant_name: string
  tenant_domain: string
  tenant_created_at: string
  tenant_updated_at: string
  admin_id: string
  admin_email: string
  admin_role: string
  user_count: number
}

// Create a function to generate columns, similar to users-table
export function createTenantColumns(): ColumnDef<TenantData>[] {
  return [
    {
      id: "tenant_name",
      accessorFn: (row) => row.tenant_name,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tenant Name" />
      ),
    },
    {
      id: "admin_email",
      accessorFn: (row) => row.admin_email,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Admin Email" />
      ),
    },
    {
      id: "user_count",
      accessorFn: (row) => row.user_count,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Users" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {row.original.user_count}
        </div>
      ),
    },
    {
      id: "tenant_created_at",
      accessorFn: (row) => row.tenant_created_at,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: ({ row }) => formatDate(row.original.tenant_created_at),
    },
    {
      accessorKey: "tenant_domain",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Domain" />
      ),
      cell: ({ row }) => {
        const domain = row.getValue("tenant_domain") as string
        return (
          <div className="flex items-center">
            {domain ? (
              <a 
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                {domain}
              </a>
            ) : (
              <span className="text-muted-foreground">No domain</span>
            )}
          </div>
        )
      },
    },
  ]
}

export function TenantsDataTable({ data }: { data: TenantData[] }) {
  const columns = useMemo(() => createTenantColumns(), [])
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="tenant_name"
      searchPlaceholder="Filter tenants..."
      pageSize={10}
      deleteAction={async (tenant) => {
        console.log("Deleting tenant:", tenant)
      }}
      editAction={async (tenant) => {
        console.log("Editing tenant:", tenant)
      }}
      viewAction={(tenant) => {
        console.log("View tenant:", tenant)
      }}
      deleteModalTitle="Delete Tenant"
      deleteModalDescription="This will permanently delete the tenant and remove all associated data."
      editModalTitle="Edit Tenant"
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={(columnId, isVisible) => {
        setColumnVisibility(prev => ({
          ...prev,
          [columnId]: isVisible
        }))
      }}
    />
  )
}

// Export the column generator function
export { createTenantColumns as tenantTableColumns } 