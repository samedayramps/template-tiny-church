import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Database } from './lib/supabase/database.types'
import { ROLE_ROUTES } from './lib/supabase/routes'

export async function middleware(request: NextRequest) {
  const requestUrl = new URL(request.url);
  
  // Create response early to allow cookie modifications
  const response = NextResponse.next();

  // Use Map for temporary cookie storage
  const cookieStore = new Map<string, string>();
  
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name) ?? request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value);
          // Use Next.js 13+ cookie API
          response.cookies.set({
            name,
            value,
            ...options,
            // Ensure proper sameSite setting
            sameSite: options.sameSite ?? 'lax'
          });
        },
        remove(name: string, options: any) {
          cookieStore.delete(name);
          response.cookies.delete(name);
        },
      }
    }
  );

  try {
    // Use Promise.all for parallel requests
    const [userResponse, sessionResponse] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession()
    ]);

    const { data: { user } } = userResponse;
    const { data: { session } } = sessionResponse;

    if (!session) {
      // Handle unauthenticated routes
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

      // Handle route protection and redirects
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
  } catch (error) {
    console.error('[Auth/Middleware] Error:', error);
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
