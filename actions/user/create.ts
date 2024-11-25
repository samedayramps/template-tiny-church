"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { Database } from "@/lib/data/supabase/database.types";
import { adminGuard } from "@/lib/auth/guards";
import { z } from "zod";
import { DBUserRole } from "@/lib/data/supabase/types";

// Define input schema for better type safety
const createUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']),
  tenantId: z.string().nullable(),
});

export async function createUser(formData: FormData) {
  const supabase = await createServerSupabaseClient(true);
  
  try {
    console.log('[User Creation] Form data received:', {
      email: formData.get('email'),
      role: formData.get('role'),
      tenantId: formData.get('tenant_id')
    });

    // Validate admin access
    const currentUser = await adminGuard();
    if (!currentUser.success) {
      redirect('/admin/users?error=Unauthorized access');
    }

    // Parse and validate input
    const input = createUserSchema.parse({
      email: formData.get('email'),
      role: formData.get('role'),
      tenantId: formData.get('tenant_id'),
    });

    console.log('[User Creation] Validated input:', input);

    // Get admin's tenant if no tenant specified
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', currentUser.data.id)
      .single();

    const effectiveTenantId = input.tenantId || adminProfile?.tenant_id || null;
    console.log('[User Creation] Effective tenant ID:', effectiveTenantId);

    // Create auth user with admin privileges
    const { data: invite, error: inviteError } = await supabase.auth.admin.createUser({
      email: input.email,
      email_confirm: true,
      user_metadata: {
        tenant_id: effectiveTenantId
      }
    });

    if (inviteError) throw inviteError;
    if (!invite?.user?.id) throw new Error('No user ID returned from invite');

    console.log('[User Creation] Auth user created:', invite.user.id);

    // Cast the role to the correct type
    const userRole = input.role as DBUserRole;
    console.log('[User Creation] Casting role:', {
      originalRole: input.role,
      castedRole: userRole,
      roleType: typeof userRole
    });

    // Use a transaction for profile and role creation
    const { error: transactionError } = await supabase.rpc('create_user_profile', {
      p_user_id: invite.user.id,
      p_email: input.email,
      p_role: userRole,
      p_tenant_id: effectiveTenantId || undefined,
      p_created_by: currentUser.data.id
    });

    if (transactionError) {
      console.error('[User Creation] Transaction error:', {
        error: transactionError,
        params: {
          p_user_id: invite.user.id,
          p_email: input.email,
          p_role: userRole,
          p_tenant_id: effectiveTenantId || undefined,
          p_created_by: currentUser.data.id
        }
      });
      // Cleanup auth user if profile creation fails
      await supabase.auth.admin.deleteUser(invite.user.id);
      throw transactionError;
    }

    console.log('[User Creation] Profile created successfully');

    // Send password reset email
    await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: input.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/protected/reset-password`
      }
    });

    // Revalidate the users page and redirect
    revalidatePath('/admin/users');
    redirect('/admin/users?success=User created successfully');

  } catch (error) {
    console.error('[User Creation] Error:', error);
    
    // Check if it's a redirect error (ensure error is an object with digest property)
    if (error && 
        typeof error === 'object' && 
        'digest' in error && 
        typeof error.digest === 'string' && 
        error.digest.startsWith('NEXT_REDIRECT')) {
      // This is an intentional redirect, not an error
      throw error;
    }
    
    if (error instanceof z.ZodError) {
      redirect('/admin/users?error=Invalid input data');
    }

    redirect('/admin/users?error=Failed to create user');
  }
} 