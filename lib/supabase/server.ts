import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { Database } from './database.types'
import { UserRole } from './types'

export const createServerSupabaseClient = cache(async () => {
  const cookieStore = await cookies()
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options)
        },
        remove(name: string) {
          cookieStore.delete(name)
        },
      },
    }
  )
})

export const getUserRole = cache(async (userId: string): Promise<UserRole> => {
  if (!userId) return UserRole.GUEST
  
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data?.role as UserRole || UserRole.GUEST
  } catch (error) {
    console.error('Error fetching user role:', error)
    return UserRole.GUEST
  }
})

export const getServerUser = cache(async () => {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }

    const role = await getUserRole(user.id)
    return { ...user, role }
  } catch (error) {
    console.error('Error getting server user:', error)
    return null
  }
})

export const ensureUserRole = async (userId: string, role: 'admin' | 'user' | 'guest' = 'user') => {
  const supabase = await createServerSupabaseClient();
  
  // First try to get existing role
  const { data: existingRole, error: fetchError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userId)
    .single();

  console.log('[Auth] Checking user role:', {
    userId,
    existingRole,
    fetchError
  });

  if (!existingRole) {
    // Create new role if doesn't exist
    const { data: newRole, error: insertError } = await supabase
      .from('user_roles')
      .insert([
        {
          id: userId,
          role,
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    console.log('[Auth] Created new user role:', {
      userId,
      role,
      error: insertError
    });

    if (insertError) {
      console.error('[Auth] Failed to create user role:', insertError);
    }
  } else if (existingRole.role !== role) {
    // Update role if it's different
    const { error: updateError } = await supabase
      .from('user_roles')
      .update({ 
        role,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    console.log('[Auth] Updated user role:', {
      userId,
      oldRole: existingRole.role,
      newRole: role,
      error: updateError
    });
  }
}; 