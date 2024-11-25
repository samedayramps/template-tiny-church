import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { NextResponse } from "next/server";
import { ROLE_ROUTES } from '@/lib/data/supabase/routes'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (!code) {
    console.log('[Auth/Callback] No code provided, redirecting to sign-in');
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const supabase = await createServerSupabaseClient();
  
  try {
    // Exchange code for session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error('[Auth/Callback] Code exchange error:', exchangeError);
      throw exchangeError;
    }

    // Get user after successful code exchange
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('[Auth/Callback] User fetch error:', userError);
      throw userError;
    }

    if (!user) {
      console.error('[Auth/Callback] No user found after code exchange');
      throw new Error('No user found after code exchange');
    }

    // Get user role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError) {
      console.error('[Auth/Callback] Role fetch error:', roleError);
    }

    const userRole = roleData?.role || 'guest';
    console.log('[Auth/Callback] Redirecting user:', {
      userId: user.id,
      role: userRole,
      redirectTo: ROLE_ROUTES[userRole]
    });

    return NextResponse.redirect(`${origin}${ROLE_ROUTES[userRole]}`);

  } catch (error) {
    console.error('[Auth/Callback] Error:', error);
    return NextResponse.redirect(`${origin}/error`);
  }
}

