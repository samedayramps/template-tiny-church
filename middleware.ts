import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { handleAuth } from './lib/auth/middleware/handlers/auth'
import { handleImpersonation } from './lib/auth/middleware/handlers/impersonation'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  try {
    // Handle impersonation first
    const impersonationResult = await handleImpersonation(request, response);
    if (impersonationResult) return impersonationResult;

    // Handle authentication
    return await handleAuth(request, response);
  } catch (error) {
    console.error('[Middleware] Error:', error);
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
