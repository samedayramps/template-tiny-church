"use client"

import { useMemo, useState, useCallback } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Users, Pencil, Eye, Trash2, Loader2 } from "lucide-react"
import { DataTable } from "@/components/ui/data-table/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { useTableHandlers } from "@/hooks/use-table-handlers"
import { useTableState } from "@/hooks/use-table-state"
import Link from "next/link"

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
  const baseColumns = useMemo(() => createTenantColumns(), []);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  // Create actions column separately
  const columnsWithActions = useMemo(() => {
    return [
      ...baseColumns,
      {
        id: "row_actions", // Changed from "actions" to be unique
        cell: ({ row }) => {
          const tenant = row.original;
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="hover:bg-muted"
              >
                <Link href={`/admin/tenants/${tenant.id}`}>
                  <Eye className="h-4 w-4" />
                  <span className="sr-only">View tenant details</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="hover:bg-muted"
              >
                <Link href={`/admin/tenants/${tenant.tenant_id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit tenant</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="hover:bg-muted"
              >
                <Link href={`/admin/tenants/${tenant.tenant_id}`}>
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete tenant</span>
                </Link>
              </Button>
            </div>
          );
        },
      },
    ];
  }, [baseColumns]);

  // Create a handler function that matches the expected type
  const handleColumnVisibilityChange = useCallback((columnId: string, isVisible: boolean) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: isVisible
    }));
  }, []);

  return (
    <DataTable
      columns={columnsWithActions}
      data={data}
      searchKey="tenant_name"
      searchPlaceholder="Filter tenants..."
      pageSize={10}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={handleColumnVisibilityChange}
    />
  );
}

// Export the column generator function
export { createTenantColumns as tenantTableColumns } 