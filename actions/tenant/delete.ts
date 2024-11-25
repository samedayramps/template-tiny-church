"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { adminGuard } from "@/lib/auth/guards";

export async function deleteTenant(tenantId: string) {
  const supabase = await createServerSupabaseClient(true);
  
  console.log('[Tenant Deletion] Starting tenant deletion process for:', tenantId);
  
  try {
    // Check if current user is admin
    const currentUser = await adminGuard();
    if (!currentUser.success) {
      console.error('[Tenant Deletion] Admin check failed:', {
        error: 'Not authorized'
      });
      redirect('/admin/tenants?error=' + encodeURIComponent('Not authorized'));
    }

    // First, update all users in this tenant to have no tenant
    console.log('[Tenant Deletion] Updating user profiles');
    const { error: profilesError } = await supabase
      .from('profiles')
      .update({ tenant_id: null })
      .eq('tenant_id', tenantId);

    if (profilesError) {
      console.error('[Tenant Deletion] Profile update failed:', profilesError);
      redirect('/admin/tenants?error=Failed to update user profiles');
    }

    // Then delete the tenant
    console.log('[Tenant Deletion] Deleting tenant');
    const { error: tenantError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (tenantError) {
      console.error('[Tenant Deletion] Tenant deletion failed:', tenantError);
      redirect('/admin/tenants?error=Failed to delete tenant');
    }

    console.log('[Tenant Deletion] Tenant successfully deleted');
    
    // Revalidate the tenants page and redirect
    revalidatePath('/admin/tenants');
    
    // Log the successful redirect
    console.log('[Tenant Deletion] Redirecting after successful deletion');
    redirect('/admin/tenants?success=Tenant deleted successfully');

  } catch (error) {
    // Check if this is a Next.js redirect
    if (error && 
        typeof error === 'object' && 
        'digest' in error && 
        typeof error.digest === 'string' && 
        error.digest.startsWith('NEXT_REDIRECT')) {
      console.log('[Tenant Deletion] Successfully redirecting', {
        timestamp: new Date().toISOString(),
        redirect: error.digest.split(';')[2], // Extract the redirect URL
        tenantId
      });
      throw error;
    }

    // Log actual unexpected errors
    console.error('[Tenant Deletion] Unexpected error:', {
      error,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      tenantId
    });

    redirect('/admin/tenants?error=Failed to delete tenant');
  }
} 