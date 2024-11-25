"use client"

import { useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Users, Pencil, Eye, Trash2, Loader2 } from "lucide-react"
import { DataTable } from "@/components/ui/data-table/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { useTableHandlers } from "@/hooks/use-table-handlers"

interface TenantData {
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
export function createTenantColumns(
  onEdit: (tenant: TenantData) => void,
  onDelete: (tenant: TenantData) => void
): ColumnDef<TenantData, any>[] {
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
      id: "actions",
      cell: ({ row }) => {
        const tenant = row.original
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(tenant)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(tenant)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      }
    }
  ]
}

export function TenantsDataTable({ data }: { data: TenantData[] }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<TenantData | null>(null)
  const { handleEdit, handleDelete, isPending } = useTableHandlers<TenantData>()

  const columns = useMemo(
    () => createTenantColumns(
      (tenant) => {
        setSelectedTenant(tenant)
        setIsEditing(true)
      },
      (tenant) => {
        setSelectedTenant(tenant)
        setIsDeleting(true)
      }
    ),
    []
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="tenant_name"
      searchPlaceholder="Filter tenants..."
      pageSize={10}
      deleteAction={async (tenant) => {
        await handleDelete(tenant, async (tenantData) => {
          // Implement your delete logic here
          console.log("Deleting tenant:", tenantData)
        })
      }}
      editAction={async (tenant) => {
        await handleEdit(tenant, async (tenantData) => {
          // Implement your edit logic here
          console.log("Editing tenant:", tenantData)
        })
      }}
      viewAction={(tenant) => {
        // View tenant logic
        console.log("View tenant:", tenant)
      }}
      deleteModalTitle="Delete Tenant"
      deleteModalDescription="This will permanently delete the tenant and remove all associated data."
      editModalTitle="Edit Tenant"
    />
  )
}

// Export the column generator function
export { createTenantColumns as tenantTableColumns } 