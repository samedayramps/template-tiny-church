"use client"

import { useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Building, Pencil, Eye, Trash2 } from "lucide-react"
import { UserRoleWithAuth } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header"
import { impersonateUser } from "@/app/actions/admin"
import { useTableHandlers } from "@/hooks/use-table-handlers"

// Create a function to generate columns
export function createUserColumns(
  onEdit: (user: UserRoleWithAuth) => void,
  onDelete: (user: UserRoleWithAuth) => void
): ColumnDef<UserRoleWithAuth>[] {
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
    {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Add your view action here
                console.log("View user:", user)
              }}
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">View</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onEdit(user)
              }}
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onDelete(user)
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="sr-only">Delete</span>
            </Button>

            <form action={impersonateUser}>
              <input type="hidden" name="userId" value={user.id} />
              <Button 
                type="submit" 
                variant="outline" 
                size="sm"
              >
                View as User
              </Button>
            </form>
          </div>
        )
      }
    }
  ]
}

export function UsersDataTable({ data }: { data: UserRoleWithAuth[] }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRoleWithAuth | null>(null)
  const { handleEdit, handleDelete, isPending } = useTableHandlers<UserRoleWithAuth>()

  const columns = useMemo(
    () => createUserColumns(
      (user) => {
        setSelectedUser(user)
        setIsEditing(true)
      },
      (user) => {
        setSelectedUser(user)
        setIsDeleting(true)
      }
    ),
    []
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="email"
      searchPlaceholder="Filter emails..."
      pageSize={10}
      deleteAction={async (user) => {
        await handleDelete(user, async (userData) => {
          // Implement your delete logic here
          console.log("Deleting user:", userData)
        })
      }}
      editAction={async (user) => {
        await handleEdit(user, async (userData) => {
          // Implement your edit logic here
          console.log("Editing user:", userData)
        })
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