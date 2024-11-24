import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  console.log('[Auth] Callback received:', {
    hasCode: !!code,
    redirectTo
  });

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('[Auth] Code exchange error:', error.message);
    } else {
      console.log('[Auth] Code exchange successful');
    }
  }

  if (redirectTo) {
    console.log('[Auth] Redirecting to:', redirectTo);
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  console.log('[Auth] Redirecting to protected page');
  return NextResponse.redirect(`${origin}/protected`);
}
