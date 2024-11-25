"use server";

import { encodedRedirect } from "@/utils/utils";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROLE_ROUTES } from '@/lib/data/supabase/routes';
import { Database } from '@/lib/data/supabase/database.types';

export async function signUpAction(formData: FormData) {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const supabase = await createServerSupabaseClient();
  const origin = (await headers()).get("origin");

  console.log('[Auth] Sign up attempt:', { email });

  if (!email || !password) {
    console.log('[Auth] Sign up failed: Missing credentials');
    return encodedRedirect("error", "/sign-up", "Email and password are required");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    console.error('[Auth] Sign up error:', error.message);
    return encodedRedirect("error", "/sign-up", error.message);
  }

  console.log('[Auth] Sign up successful:', { email });
  return encodedRedirect(
    "success",
    "/sign-up",
    "Thanks for signing up! Please check your email for a verification link."
  );
}

export async function signInAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createServerSupabaseClient();

  console.log('[Auth] Sign in attempt:', { email });

  const { data: { user }, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('[Auth] Sign in error:', error.message);
    return encodedRedirect("error", "/sign-in", error.message);
  }

  if (user) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('[Auth] Sign in successful:', { 
      email,
      userId: user.id,
      role: roleData?.role,
      redirectTo: ROLE_ROUTES[roleData?.role || 'guest']
    });

    const userRole = (roleData?.role || 'guest') as Database['public']['Enums']['user_role'];
    return redirect(ROLE_ROUTES[userRole]);
  }

  console.log('[Auth] Fallback redirect to protected route');
  return redirect("/protected");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = formData.get("email")?.toString();
  const supabase = await createServerSupabaseClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect("error", "/forgot-password", "Could not reset password");
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password."
  );
}

export async function resetPasswordAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required"
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "Passwords do not match"
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password update failed"
    );
  }

  return encodedRedirect("success", "/protected/reset-password", "Password updated");
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  console.log('[Auth] Sign out attempt');
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('[Auth] Sign out error:', error.message);
  } else {
    console.log('[Auth] Sign out successful');
  }
  
  return redirect("/sign-in");
} 