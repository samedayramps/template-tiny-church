import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { Database } from "./database.types";

export const handleImpersonation = async (request: NextRequest) => {
  const sessionId = request.cookies.get('impersonation_id')?.value;
  if (!sessionId) {
    return NextResponse.next();
  }

  console.log('[Impersonation Middleware] Checking session:', sessionId);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
      },
    }
  );

  const { data: session, error } = await supabase
    .from('impersonation_sessions')
    .select(`
      *,
      admin:profiles!impersonation_sessions_admin_id_fkey (
        email
      ),
      impersonated:profiles!impersonation_sessions_impersonated_id_fkey (
        email,
        role
      )
    `)
    .eq('id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error) {
    console.error('[Impersonation Middleware] Error:', error);
    return NextResponse.next();
  }

  if (!session) {
    console.log('[Impersonation Middleware] No active session found');
    return NextResponse.next();
  }

  console.log('[Impersonation Middleware] Active session found:', session);

  // Block admin routes during impersonation
  if (request.nextUrl.pathname.startsWith('/admin')) {
    console.log('[Impersonation Middleware] Redirecting from admin route to dashboard');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}; 