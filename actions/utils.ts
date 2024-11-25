"use server";

import { createServerSupabaseClient } from "@/lib/data/supabase/server";

export async function checkAdminRole(userId: string) {
  const supabase = await createServerSupabaseClient();
  
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userId)
    .single();
    
  return roleData?.role === 'admin';
} 