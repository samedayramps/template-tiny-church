import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  try {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    console.log('[Middleware] Auth check:', {
      path: request.nextUrl.pathname,
      authenticated: !!user,
      error: userError?.message
    });

    // protected routes
    if (request.nextUrl.pathname.startsWith("/protected") && userError) {
      console.log('[Middleware] Redirecting unauthenticated user to /sign-in');
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    if (request.nextUrl.pathname === "/" && !userError) {
      console.log('[Middleware] Redirecting authenticated user to /protected');
      return NextResponse.redirect(new URL("/protected", request.url));
    }

    return response;
  } catch (e) {
    console.error('[Middleware] Error:', e);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
