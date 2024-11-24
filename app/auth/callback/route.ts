import { createServerSupabaseClient, ensureUserRole } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ROLE_ROUTES, DEFAULT_REDIRECT } from '@/lib/supabase/routes'
import { Database } from '@/lib/supabase/database.types'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  console.log('[Auth] Callback received:', {
    hasCode: !!code,
    redirectTo,
    origin
  });

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('[Auth] Code exchange error:', error.message);
      return NextResponse.redirect(`${origin}/error`);
    }

    console.log('[Auth] Code exchange successful');
    
    // Check if user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('[Auth] User check:', {
      hasUser: !!user,
      userId: user?.id,
      userError
    });

    if (user) {
      // Ensure user has a role
      await ensureUserRole(user.id, 'admin'); // Set to admin for your user

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', user.id)
        .single();
        
      console.log('[Auth] Role check:', {
        roleData,
        roleError,
        userId: user.id,
        sql: `SELECT role FROM user_roles WHERE id = '${user.id}'`
      });

      const userRole = (roleData?.role || 'guest') as Database['public']['Enums']['user_role']
      console.log('[Auth] Redirecting with role:', {
        userRole,
        redirectPath: ROLE_ROUTES[userRole]
      });

      return NextResponse.redirect(`${origin}${ROLE_ROUTES[userRole]}`)
    }
  }

  console.log('[Auth] Fallback redirect:', DEFAULT_REDIRECT);
  return NextResponse.redirect(`${origin}${DEFAULT_REDIRECT}`);
}

