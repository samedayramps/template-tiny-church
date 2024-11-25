"use server";

import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { adminGuard } from "@/lib/auth/guards";
import { encodedRedirect } from "@/utils/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteUser(userId: string) {
  const supabase = await createServerSupabaseClient(true);
  
  console.log('[User Deletion] Starting user deletion process for:', userId);
  
  try {
    // Check if current user is admin
    const currentUser = await adminGuard();
    if (!currentUser.success) {
      redirect('/admin/users?error=' + encodeURIComponent(currentUser.error));
    }

    // Delete in correct order
    console.log('[User Deletion] Deleting user role');
    const { error: roleError } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', userId);

    if (roleError) {
      console.error('[User Deletion] Role deletion failed:', roleError);
      redirect('/admin/users?error=Failed to delete user role');
    }

    console.log('[User Deletion] Deleting user profile');
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('[User Deletion] Profile deletion failed:', profileError);
      redirect('/admin/users?error=Failed to delete user profile');
    }

    console.log('[User Deletion] Deleting auth user');
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('[User Deletion] Auth user deletion failed:', authError);
      redirect('/admin/users?error=Failed to delete user');
    }

    console.log('[User Deletion] User successfully deleted');
    
    // Revalidate the users page and redirect
    revalidatePath('/admin/users');
    redirect('/admin/users?success=User deleted successfully');

  } catch (error) {
    console.error('[User Deletion] Error:', error);
    
    // Check if it's a redirect error
    if (error && 
        typeof error === 'object' && 
        'digest' in error && 
        typeof error.digest === 'string' && 
        error.digest.startsWith('NEXT_REDIRECT')) {
      // This is an intentional redirect, not an error
      throw error;
    }

    redirect('/admin/users?error=Failed to delete user');
  }
} 