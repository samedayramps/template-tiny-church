import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseClient } from '../../middleware/utils/supabase'

export async function handleImpersonation(request: NextRequest, response: NextResponse) {
  const requestUrl = new URL(request.url);
  const sessionId = request.cookies.get('impersonation_id')?.value;
  
  if (!sessionId) return null;

  const supabase = createSupabaseClient(request, response);
  
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
    return null;
  }

  if (session && requestUrl.pathname.startsWith('/admin')) {
    console.log('[Impersonation Middleware] Redirecting from admin route to dashboard');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return null;
} 