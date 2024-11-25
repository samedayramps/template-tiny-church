"use client"

import { z } from "zod"
import { EditForm } from "@/components/ui/form/edit-form"
import { useState, useEffect } from "react"
import { createClientSupabaseClient } from "@/lib/data/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Database } from "@/lib/data/supabase/database.types"

const userFormSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "user", "guest"]),
  tenant_id: z.string().optional().nullable(),
})

type UserFormValues = z.infer<typeof userFormSchema>
type TenantSelectOption = Pick<Database['public']['Tables']['tenants']['Row'], 'id' | 'name'>

interface EditUserFormProps {
  user: UserFormValues
  onSuccess?: () => void
}

export function EditUserForm({ user, onSuccess }: EditUserFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tenants, setTenants] = useState<TenantSelectOption[]>([])
  const { toast } = useToast()

  useEffect(() => {
    async function fetchTenants() {
      const supabase = createClientSupabaseClient()
      const { data: tenantsData, error } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name')

      if (error) {
        console.error("[EditUserForm] Error fetching tenants:", error)
        toast({
          title: "Error",
          description: "Failed to load tenants",
          variant: "destructive",
        })
        return
      }

      setTenants(tenantsData)
    }

    fetchTenants()
  }, [toast])
  
  const fields = [
    {
      name: "email" as const,
      label: "Email",
      type: "email",
      placeholder: "user@example.com",
    },
    {
      name: "role" as const,
      label: "Role",
      type: "select",
      placeholder: "Select a role",
      options: [
        { label: "Admin", value: "admin" },
        { label: "User", value: "user" },
        { label: "Guest", value: "guest" },
      ],
    },
    {
      name: "tenant_id" as const,
      label: "Tenant",
      type: "select",
      placeholder: "Select a tenant",
      description: "The tenant this user belongs to",
      options: [
        { label: "No Tenant", value: "none" },
        ...tenants.map(tenant => ({
          label: tenant.name,
          value: tenant.id,
        })),
      ],
    },
  ]

  const onSubmit = async (data: UserFormValues) => {
    console.log("[EditUserForm] Starting update for user:", {
      id: data.id,
      current_values: data,
      previous_values: user
    })
    setIsSubmitting(true)
    
    try {
      const supabase = createClientSupabaseClient()
      
      console.log("[EditUserForm] Updating user profile:", {
        id: data.id,
        email: data.email,
        role: data.role,
        tenant_id: data.tenant_id,
        timestamp: new Date().toISOString()
      })

      const tenant_id = data.tenant_id === "none" ? null : data.tenant_id
      
      const { data: updatedUser, error } = await supabase
        .from('profiles')
        .update({
          email: data.email,
          role: data.role,
          tenant_id: tenant_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id)
        .select()
        .single()

      if (error) {
        console.error("[EditUserForm] Update failed:", {
          error,
          attempted_update: {
            email: data.email,
            role: data.role,
            tenant_id: data.tenant_id
          }
        })
        throw error
      }

      console.log("[EditUserForm] User updated successfully:", updatedUser)
      toast({
        title: "Success",
        description: "User updated successfully",
      })
      onSuccess?.()
    } catch (error) {
      console.error("[EditUserForm] Error updating user:", {
        error,
        attempted_update: data
      })
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <EditForm
      schema={userFormSchema}
      defaultValues={user}
      onSubmit={onSubmit}
      fields={fields}
      isSubmitting={isSubmitting}
    />
  )
} 