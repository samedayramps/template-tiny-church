"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { Database } from "@/lib/data/supabase/database.types";
import { adminGuard } from "@/lib/auth/guards";
import { z } from "zod";

const createTenantSchema = z.object({
  name: z.string().min(1, "Tenant name is required"),
  adminId: z.string().uuid("Invalid admin ID"),
});

export async function createTenant(formData: FormData) {
  const supabase = await createServerSupabaseClient(true);
  
  console.log('[Tenant Creation] Starting tenant creation process', {
    timestamp: new Date().toISOString(),
    formData: {
      name: formData.get('name'),
      adminId: formData.get('adminId'),
    }
  });
  
  try {
    // Parse and validate input
    console.log('[Tenant Creation] Validating input data');
    const input = createTenantSchema.parse({
      name: formData.get('name'),
      adminId: formData.get('adminId'),
    });
    console.log('[Tenant Creation] Input validation successful', { input });

    // Check if current user is admin
    console.log('[Tenant Creation] Checking admin permissions');
    const currentUser = await adminGuard();
    if (!currentUser.success) {
      console.error('[Tenant Creation] Admin check failed', {
        error: 'Not authorized',
        success: currentUser.success
      });
      redirect('/admin/tenants?error=Not authorized');
    }
    console.log('[Tenant Creation] Admin check passed', {
      userId: currentUser.data.id
    });

    // Check if tenant name already exists
    console.log('[Tenant Creation] Checking for existing tenant', {
      tenantName: input.name
    });
    const { data: existingTenant, error: existingTenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', input.name)
      .single();

    if (existingTenantError && existingTenantError.code !== 'PGRST116') {
      console.error('[Tenant Creation] Error checking existing tenant:', {
        error: existingTenantError,
        tenantName: input.name
      });
      redirect('/admin/tenants?error=Failed to check existing tenant');
    }

    if (existingTenant) {
      console.warn('[Tenant Creation] Tenant name already exists', {
        tenantName: input.name,
        existingTenantId: existingTenant.id
      });
      redirect('/admin/tenants?error=A tenant with this name already exists');
    }
    console.log('[Tenant Creation] Tenant name is available');

    // Check if admin exists and verify role
    console.log('[Tenant Creation] Verifying admin user', {
      adminId: input.adminId
    });
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', input.adminId)
      .single();

    if (adminError) {
      console.error('[Tenant Creation] Error fetching admin profile:', {
        error: adminError,
        adminId: input.adminId
      });
      redirect('/admin/tenants?error=Failed to verify admin user');
    }

    if (!adminProfile) {
      console.error('[Tenant Creation] Admin user not found', {
        adminId: input.adminId
      });
      redirect('/admin/tenants?error=Admin user not found');
    }

    if (adminProfile.role !== 'admin') {
      console.error('[Tenant Creation] User is not an admin', {
        adminId: input.adminId,
        actualRole: adminProfile.role
      });
      redirect('/admin/tenants?error=Selected user is not an admin');
    }

    if (adminProfile.tenant_id) {
      console.error('[Tenant Creation] Admin already assigned to tenant', {
        adminId: input.adminId,
        existingTenantId: adminProfile.tenant_id
      });
      redirect('/admin/tenants?error=Selected admin is already assigned to a tenant');
    }

    console.log('[Tenant Creation] Admin verification successful');

    // Create tenant using RPC
    console.log('[Tenant Creation] Creating tenant via RPC', {
      tenantName: input.name,
      adminId: input.adminId
    });
    const { data: newTenant, error: tenantError } = await supabase
      .rpc('create_tenant', {
        tenant_name: input.name,
        admin_user_id: input.adminId
      });

    if (tenantError) {
      console.error('[Tenant Creation] RPC error creating tenant:', {
        error: tenantError,
        input
      });
      redirect('/admin/tenants?error=Failed to create tenant');
    }

    console.log('[Tenant Creation] Tenant created successfully', {
      tenant: newTenant,
      timestamp: new Date().toISOString()
    });

    // Revalidate and redirect
    revalidatePath('/admin/tenants');
    redirect('/admin/tenants?success=Tenant created successfully');

  } catch (error) {
    if (error && 
        typeof error === 'object' && 
        'digest' in error && 
        typeof error.digest === 'string' && 
        error.digest.startsWith('NEXT_REDIRECT')) {
      console.log('[Tenant Creation] Successfully redirecting', {
        timestamp: new Date().toISOString(),
        redirect: error.digest.split(';')[2] // Extract the redirect URL
      });
      throw error;
    }

    // Log actual unexpected errors
    console.error('[Tenant Creation] Unexpected error:', {
      error,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });

    if (error instanceof z.ZodError) {
      console.error('[Tenant Creation] Validation error:', {
        validationErrors: error.errors,
        formData: {
          name: formData.get('name'),
          adminId: formData.get('adminId'),
        }
      });
      redirect('/admin/tenants?error=Invalid input data');
    }

    redirect('/admin/tenants?error=Failed to create tenant');
  }
} 