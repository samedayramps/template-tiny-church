import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { Database } from './database.types'
import { UserRole } from './types'
import { User } from '@supabase/supabase-js'
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

// Define proper types for database operations
type UserRoleRow = Database['public']['Tables']['user_roles']['Row']
type UserRoleInsert = Database['public']['Tables']['user_roles']['Insert']
type UserRoleUpdate = Database['public']['Tables']['user_roles']['Update']

// Update type definitions to match database types
type DBUserRole = Database['public']['Enums']['user_role']

export const createServerSupabaseClient = cache(async (useServiceRole: boolean = false) => {
  const cookieStore = await cookies()
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    useServiceRole ? process.env.SUPABASE_SERVICE_ROLE_KEY! : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Convert CookieOptions to ResponseCookie format
            const { sameSite, ...rest } = options
            cookieStore.set({
              name,
              value,
              ...rest,
              sameSite: sameSite as ResponseCookie['sameSite']
            })
          } catch (error) {
            console.error('Cookie set error:', error)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // Convert CookieOptions to ResponseCookie format
            const { sameSite, ...rest } = options
            cookieStore.delete({
              name,
              ...rest,
              sameSite: sameSite as ResponseCookie['sameSite']
            })
          } catch (error) {
            console.error('Cookie remove error:', error)
          }
        },
      },
    }
  )
})

export const getServerUser = cache(async () => {
  const supabase = await createServerSupabaseClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (roleError) {
      console.error('Error fetching user role:', roleError)
      return { ...user, role: 'guest' as const }
    }

    return { ...user, role: (roleData?.role || 'guest') as UserRole }
  } catch (error) {
    console.error('Error getting server user:', error)
    return null
  }
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
    return (data?.role as UserRole) || UserRole.GUEST
  } catch (error) {
    console.error('Error fetching user role:', error)
    return UserRole.GUEST
  }
})

export const ensureUserRole = async (
  userId: string, 
  role: DBUserRole = 'user' // Use string literal type instead of enum
) => {
  const supabase = await createServerSupabaseClient()
  
  const { data: existingRole, error: fetchError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userId)
    .single()

  console.log('[Auth] Checking user role:', {
    userId,
    existingRole,
    fetchError
  })

  if (!existingRole) {
    const insertData: UserRoleInsert = {
      id: userId,
      role: role as DBUserRole, // Cast to database enum type
      updated_at: new Date().toISOString()
    }

    const { error: insertError } = await supabase
      .from('user_roles')
      .insert([insertData])
      .single()

    console.log('[Auth] Created new user role:', {
      userId,
      role,
      error: insertError
    })

    if (insertError) {
      console.error('[Auth] Failed to create user role:', insertError)
    }
  } else if (existingRole.role !== role) {
    const updateData: UserRoleUpdate = {
      role: role as DBUserRole, // Cast to database enum type
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('user_roles')
      .update(updateData)
      .eq('id', userId)

    console.log('[Auth] Updated user role:', {
      userId,
      oldRole: existingRole.role,
      newRole: role,
      error: updateError
    })
  }
} 