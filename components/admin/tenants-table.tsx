"use client"

import { useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Users, Pencil, Eye, Trash2 } from "lucide-react"

import { DataTable } from "@/components/ui/data-table/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface TenantData {
  tenant_id: string
  tenant_name: string
  tenant_created_at: string
  tenant_updated_at: string
  admin_id: string
  admin_email: string
  admin_role: string
  user_count: number
}

export function TenantsDataTable({ data }: { data: TenantData[] }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<TenantData | null>(null)

  const handleEdit = (tenant: TenantData) => {
    setSelectedTenant(tenant)
    setIsEditing(true)
  }

  const handleDelete = (tenant: TenantData) => {
    setSelectedTenant(tenant)
    setIsDeleting(true)
  }

  const columns = useMemo<ColumnDef<TenantData>[]>(() => [
    {
      id: "tenant_name",
      accessorKey: "tenant_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tenant Name" />
      ),
    },
    {
      id: "admin_email",
      accessorKey: "admin_email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Admin Email" />
      ),
    },
    {
      id: "user_count",
      accessorKey: "user_count",
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
      accessorKey: "tenant_created_at",
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
              size="sm"
              onClick={() => {
                // Add your view action here
                console.log("View tenant:", tenant)
              }}
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">View</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(tenant)}
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(tenant)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        )
      }
    }
  ], [])

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchKey="tenant_name"
        searchPlaceholder="Filter tenants..."
        pageSize={10}
      />

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            // Add your tenant update logic here
            setIsEditing(false)
            toast({
              title: "Success",
              description: "Tenant updated successfully",
            })
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tenant_name">Tenant Name</Label>
                <Input
                  id="tenant_name"
                  name="tenant_name"
                  defaultValue={selectedTenant?.tenant_name}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admin_email">Admin Email</Label>
                <Input
                  id="admin_email"
                  name="admin_email"
                  defaultValue={selectedTenant?.admin_email}
                  type="email"
                  disabled
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tenant
              and remove all associated data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!selectedTenant) return
                
                try {
                  // Add your delete action here
                  // await deleteTenant(selectedTenant.tenant_id)
                  setIsDeleting(false)
                  toast({
                    title: "Success",
                    description: "Tenant deleted successfully",
                  })
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to delete tenant",
                    variant: "destructive",
                  })
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 