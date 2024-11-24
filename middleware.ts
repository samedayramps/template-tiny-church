import { updateSession } from "@/lib/supabase/middleware";
import { handleImpersonation } from "@/lib/supabase/impersonation-middleware";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // First, handle auth session
  const sessionResponse = await updateSession(request);
  if (sessionResponse.status !== 200) {
    return sessionResponse;
  }

  // Then, handle impersonation
  const impersonationResponse = await handleImpersonation(request);
  if (impersonationResponse.headers.get('location')) {
    return impersonationResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
