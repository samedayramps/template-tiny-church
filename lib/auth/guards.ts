"use server";

import { createServerSupabaseClient } from "@/lib/data/supabase/server";

type AdminGuardResult = 
  | { success: true; data: { id: string } }
  | { success: false; error: string };

export async function adminGuard(): Promise<AdminGuardResult> {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return { success: false, error: "User not found" };
  }

  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (currentUserRole?.role !== 'admin') {
    return { success: false, error: "Only admins can perform this action" };
  }

  return { success: true, data: { id: user.id } };
} 