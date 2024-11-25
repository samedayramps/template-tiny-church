"use server";

import { encodedRedirect } from "@/utils/utils";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";

export async function updateUserProfile(formData: FormData) {
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
    return encodedRedirect("error", "/admin/users", "Only admins can update user profiles");
  }
  
  const userId = formData.get('userId') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as 'admin' | 'user' | 'guest';
  const metadata = JSON.parse(formData.get('metadata') as string);
  const rawUserMetaData = JSON.parse(formData.get('raw_user_meta_data') as string);
  
  // Update profiles table
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      email,
      role,
      metadata,
      raw_user_meta_data: rawUserMetaData,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (profileError) {
    return encodedRedirect("error", "/admin/users", "Failed to update user profile");
  }

  // Update user_roles table
  const { error: roleError } = await supabase
    .from('user_roles')
    .update({ 
      role,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (roleError) {
    return encodedRedirect("error", "/admin/users", "Failed to update user role");
  }

  return encodedRedirect("success", "/admin/users", "User profile updated successfully");
} 