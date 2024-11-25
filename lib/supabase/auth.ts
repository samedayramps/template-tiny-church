import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { cache } from 'react'

export const getUserRole = cache(async (supabase: SupabaseClient<Database>, userId: string) => {
  console.log('[Auth/Role] Fetching role for user:', { userId });
  
  try {
    const { data: roleData, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('[Auth/Role] Error fetching user role:', {
        error: error.message,
        userId,
        sql: `SELECT role FROM user_roles WHERE id = '${userId}'`
      });
      return null;
    }
    
    console.log('[Auth/Role] Role found:', {
      userId,
      role: roleData?.role
    });
    
    return roleData?.role;
  } catch (error) {
    console.error('[Auth/Role] Unexpected error:', {
      error,
      userId
    });
    return null;
  }
});

// Helper function to check if user has admin role
export async function isAdmin(supabase: SupabaseClient<Database>, userId: string) {
  console.log('[Auth/Admin] Checking admin status:', { userId });
  
  const role = await getUserRole(supabase, userId);
  const isAdminUser = role === 'admin';
  
  console.log('[Auth/Admin] Admin check result:', {
    userId,
    role,
    isAdmin: isAdminUser
  });
  
  return isAdminUser;
} 