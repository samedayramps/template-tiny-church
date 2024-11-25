import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseClient } from '../../middleware/utils/supabase'
import { ROLE_ROUTES } from '../../../data/supabase/routes'

export async function handleAuth(request: NextRequest, response: NextResponse) {
  const requestUrl = new URL(request.url);
  const supabase = createSupabaseClient(request, response);

  const [userResponse, sessionResponse] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession()
  ]);

  const { data: { user } } = userResponse;
  const { data: { session } } = sessionResponse;

  if (!session) {
    if (requestUrl.pathname.startsWith('/admin') || 
        requestUrl.pathname.startsWith('/protected')) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
    return response;
  }

  if (user) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = roleData?.role || 'guest';

    const isAuthPage = requestUrl.pathname.startsWith('/sign-in') || 
                      requestUrl.pathname.startsWith('/sign-up');
    const isAdminPage = requestUrl.pathname.startsWith('/admin');
    const isRootPage = requestUrl.pathname === '/';

    if (isAdminPage && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    if (isAuthPage || isRootPage) {
      return NextResponse.redirect(new URL(ROLE_ROUTES[userRole], request.url));
    }
  }

  return response;
} 