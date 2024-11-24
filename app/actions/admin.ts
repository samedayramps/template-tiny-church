"use server";

import { encodedRedirect } from "@/utils/utils";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { startImpersonation, stopImpersonation as stopImpersonationUtil } from "@/lib/supabase/impersonation";

export async function adminOnlyAction() {
  const supabase = await createServerSupabaseClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', session.user.id)
    .single();
    
  if (roleData?.role !== 'admin') {
    throw new Error('Unauthorized');
  }
}

export async function updateUserRole(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  
  // Check if current user is admin
  const currentUser = await supabase.auth.getUser();
  if (!currentUser.data.user?.id) {
    return encodedRedirect("error", "/admin/users", "User not found");
  }

  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', currentUser.data.user.id)
    .single();
    
  if (currentUserRole?.role !== 'admin') {
    return encodedRedirect("error", "/admin/users", "Only admins can update user roles");
  }
  
  const userId = formData.get('userId') as string;
  const newRole = formData.get('role') as 'admin' | 'user' | 'guest';
  
  const { error } = await supabase
    .from('user_roles')
    .update({ 
      role: newRole,
      updated_at: new Date().toISOString(),
      updated_by: currentUser.data.user.id
    })
    .eq('id', userId);

  if (error) {
    return encodedRedirect("error", "/admin/users", "Failed to update user role");
  }

  return encodedRedirect("success", "/admin/users", "User role updated successfully");
}

export async function impersonateUser(formData: FormData) {
  try {
    const userId = formData.get('userId') as string;
    if (!userId) {
      throw new Error('No user ID provided');
    }

    const session = await startImpersonation(userId);
    return encodedRedirect(
      "success", 
      "/dashboard",
      `Now viewing as ${session.impersonated?.email}`
    );
  } catch (error) {
    console.error('[Impersonation] Failed to start:', error);
    return encodedRedirect(
      "error",
      "/admin/users",
      error instanceof Error ? error.message : 'Failed to impersonate user'
    );
  }
}

export async function stopImpersonation() {
  try {
    console.log('[Action] Stopping impersonation');
    await stopImpersonationUtil();
    console.log('[Action] Successfully stopped impersonation');
    
    return encodedRedirect("success", "/admin/users", "Stopped impersonation");
  } catch (error) {
    console.error('[Action] Failed to stop impersonation:', error);
    throw error;
  }
}

export async function createTenant(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  
  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return encodedRedirect("error", "/admin/tenants", "User not found");
  }

  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (currentUserRole?.role !== 'admin') {
    return encodedRedirect("error", "/admin/tenants", "Only admins can create tenants");
  }
  
  const name = formData.get('name') as string;
  const adminEmail = formData.get('admin_email') as string;
  
  // Start a transaction
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ 
      name,
      admin_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (tenantError) {
    return encodedRedirect("error", "/admin/tenants", "Failed to create tenant");
  }

  // Update the admin's profile with the tenant_id
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      tenant_id: tenant.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (profileError) {
    return encodedRedirect("error", "/admin/tenants", "Failed to update admin profile");
  }

  return encodedRedirect("success", "/admin/tenants", "Tenant created successfully");
}

export async function updateTenantAdmin(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  
  const tenantId = formData.get('tenant_id') as string;
  const newAdminId = formData.get('admin_id') as string;
  
  // Start a transaction
  const { error: tenantError } = await supabase
    .from('tenants')
    .update({ 
      admin_id: newAdminId,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantId);

  if (tenantError) {
    return encodedRedirect("error", "/admin/tenants", "Failed to update tenant admin");
  }

  // Update the new admin's profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      tenant_id: tenantId,
      updated_at: new Date().toISOString()
    })
    .eq('id', newAdminId);

  if (profileError) {
    return encodedRedirect("error", "/admin/tenants", "Failed to update admin profile");
  }

  return encodedRedirect("success", "/admin/tenants", "Tenant admin updated successfully");
} 