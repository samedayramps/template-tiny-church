"use client"

import { Button } from "@/components/ui/button"
import { deleteTenant } from "@/actions/tenant/delete"
import { Trash2 } from "lucide-react"

export function DeleteTenantButton({ tenantId }: { tenantId: string }) {
  return (
    <Button
      variant="destructive"
      onClick={async () => {
        if (confirm("Are you sure you want to delete this tenant? This action cannot be undone.")) {
          await deleteTenant(tenantId)
        }
      }}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Delete Tenant
    </Button>
  )
} 