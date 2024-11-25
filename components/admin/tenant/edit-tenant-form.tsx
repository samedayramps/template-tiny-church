"use client"

import { z } from "zod"
import { EditForm } from "@/components/ui/form/edit-form"
import { useState } from "react"
import { createClientSupabaseClient } from "@/lib/data/supabase/client"
import { useToast } from "@/hooks/use-toast"

const tenantFormSchema = z.object({
  id: z.string().uuid(),
  tenant_name: z.string().min(2, "Name must be at least 2 characters"),
  tenant_domain: z.string().optional(),
  admin_email: z.string().email("Invalid email address"),
})

type TenantFormValues = z.infer<typeof tenantFormSchema>

interface EditTenantFormProps {
  tenant: TenantFormValues
  onSuccess?: () => void
}

export function EditTenantForm({ tenant, onSuccess }: EditTenantFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  
  const fields = [
    {
      name: "tenant_name" as const,
      label: "Tenant Name",
      placeholder: "Enter tenant name",
    },
    {
      name: "tenant_domain" as const,
      label: "Domain",
      placeholder: "example.com",
      description: "The domain associated with this tenant",
    },
    {
      name: "admin_email" as const,
      label: "Admin Email",
      type: "email",
      placeholder: "admin@example.com",
    },
  ]

  const onSubmit = async (data: TenantFormValues) => {
    console.log("[EditTenantForm] Starting update for tenant:", {
      id: data.id,
      current_values: data,
      previous_values: tenant,
      changes: {
        name: data.tenant_name !== tenant.tenant_name,
        domain: data.tenant_domain !== tenant.tenant_domain,
        admin: data.admin_email !== tenant.admin_email
      }
    })
    setIsSubmitting(true)
    
    try {
      const supabase = createClientSupabaseClient()
      
      // Check if tenant name or domain already exists (except for current tenant)
      const { data: existingTenant, error: checkError } = await supabase
        .from('tenants')
        .select('id')
        .or(`name.eq."${data.tenant_name}",domain.eq."${data.tenant_domain}"`)
        .neq('id', data.id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error("[EditTenantForm] Error checking existing tenant:", checkError)
        throw new Error("Failed to validate tenant details")
      }

      if (existingTenant) {
        console.error("[EditTenantForm] Tenant name or domain already exists:", {
          attempted_name: data.tenant_name,
          attempted_domain: data.tenant_domain,
          existing_tenant: existingTenant.id
        })
        throw new Error("A tenant with this name or domain already exists")
      }
      
      console.log("[EditTenantForm] Updating tenant details:", {
        id: data.id,
        name: data.tenant_name,
        domain: data.tenant_domain,
        timestamp: new Date().toISOString()
      })

      // First update the tenant details
      const { data: updatedTenant, error: tenantError } = await supabase
        .from('tenants')
        .update({
          name: data.tenant_name,
          domain: data.tenant_domain,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id)
        .select()

      if (tenantError) {
        console.error("[EditTenantForm] Tenant update failed:", {
          error: tenantError,
          attempted_update: {
            name: data.tenant_name,
            domain: data.tenant_domain
          }
        })
        throw tenantError
      }

      console.log("[EditTenantForm] Tenant details updated successfully:", updatedTenant)

      // Then update the admin email if it changed
      if (data.admin_email !== tenant.admin_email) {
        console.log("[EditTenantForm] Admin email change detected:", {
          previous: tenant.admin_email,
          new: data.admin_email,
          tenant_id: data.id
        })
        
        // Check if new admin email exists and is not already an admin of another tenant
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, email, role, tenant_id')
          .eq('email', data.admin_email)
          .single()

        if (userError) {
          console.error("[EditTenantForm] Failed to find user for admin email:", {
            error: userError,
            email: data.admin_email
          })
          throw new Error("User not found for the specified admin email")
        }

        if (userData.tenant_id && userData.tenant_id !== data.id) {
          console.error("[EditTenantForm] User already associated with another tenant:", {
            user_id: userData.id,
            current_tenant: userData.tenant_id,
            attempted_tenant: data.id
          })
          throw new Error("Selected user is already associated with another tenant")
        }

        console.log("[EditTenantForm] Found user for new admin:", userData)

        // Update the tenant's admin_id
        const { data: updatedAdmin, error: adminError } = await supabase
          .from('tenants')
          .update({
            admin_id: userData.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.id)
          .select()

        if (adminError) {
          console.error("[EditTenantForm] Admin update failed:", {
            error: adminError,
            user: userData
          })
          throw adminError
        }

        console.log("[EditTenantForm] Admin updated successfully:", updatedAdmin)
      }

      console.log("[EditTenantForm] All updates completed successfully")
      toast({
        title: "Success",
        description: "Tenant updated successfully",
      })
      onSuccess?.()
    } catch (error) {
      console.error("[EditTenantForm] Error updating tenant:", {
        error,
        attempted_update: data
      })
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update tenant",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <EditForm
      schema={tenantFormSchema}
      defaultValues={tenant}
      onSubmit={onSubmit}
      fields={fields}
      isSubmitting={isSubmitting}
    />
  )
} 