"use server";

import { encodedRedirect } from "@/utils/utils";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { startImpersonation as startImpersonationUtil, stopImpersonation as stopImpersonationUtil } from "@/lib/supabase/impersonation";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const supabase = await createServerSupabaseClient();
  const origin = (await headers()).get("origin");

  console.log('[Auth] Sign up attempt:', { email });

  if (!email || !password) {
    console.log('[Auth] Sign up failed: Missing credentials');
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required",
    );
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
  } else {
    console.log('[Auth] Sign up successful:', { email });
    return encodedRedirect(
      "success",
      "/sign-up",
      "Thanks for signing up! Please check your email for a verification link.",
    );
  }
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createServerSupabaseClient();

  console.log('[Auth] Sign in attempt:', { email });

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('[Auth] Sign in error:', error.message);
    return encodedRedirect("error", "/sign-in", error.message);
  }

  console.log('[Auth] Sign in successful:', { email });
  return redirect("/protected");
};

export const forgotPasswordAction = async (formData: FormData) => {
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
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password.",
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createServerSupabaseClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Passwords do not match",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password update failed",
    );
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createServerSupabaseClient();
  console.log('[Auth] Sign out attempt');
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('[Auth] Sign out error:', error.message);
  } else {
    console.log('[Auth] Sign out successful');
  }
  
  return redirect("/sign-in");
};

export async function adminOnlyAction() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', session.user.id)
    .single()
    
  if (roleData?.role !== 'admin') {
    throw new Error('Unauthorized')
  }
  
  // Proceed with admin-only action
}

export async function updateUserRole(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  
  // Check if current user is admin
  const currentUser = await supabase.auth.getUser()
  if (!currentUser.data.user?.id) {
    return encodedRedirect(
      "error",
      "/admin/users",
      "User not found"
    );
  }

  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', currentUser.data.user.id)
    .single();
    
  if (currentUserRole?.role !== 'admin') {
    return encodedRedirect(
      "error",
      "/admin/users",
      "Only admins can update user roles"
    );
  }
  
  const userId = formData.get('userId') as string;
  const newRole = formData.get('role') as 'admin' | 'user' | 'guest';
  
  const { error } = await supabase
    .from('user_roles')
    .update({ 
      role: newRole,
      updated_at: new Date().toISOString(),
      updated_by: (await supabase.auth.getUser()).data.user?.id
    })
    .eq('id', userId);

  if (error) {
    return encodedRedirect(
      "error",
      "/admin/users",
      "Failed to update user role"
    );
  }

  return encodedRedirect(
    "success",
    "/admin/users",
    "User role updated successfully"
  );
}

export async function updateUserProfile(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  
  // Check if current user is admin
  const currentUser = await supabase.auth.getUser()
  if (!currentUser.data.user?.id) {
    return encodedRedirect(
      "error",
      "/admin/users",
      "User not found"
    );
  }

  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', currentUser.data.user.id)
    .single();
    
  if (currentUserRole?.role !== 'admin') {
    return encodedRedirect(
      "error",
      "/admin/users",
      "Only admins can update user profiles"
    );
  }
  
  const userId = formData.get('userId') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as 'admin' | 'user' | 'guest';
  const metadata = JSON.parse(formData.get('metadata') as string);
  const rawUserMetaData = JSON.parse(formData.get('raw_user_meta_data') as string);
  
  // Update profiles table
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      email,
      role,
      metadata,
      raw_user_meta_data: rawUserMetaData,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (profileError) {
    return encodedRedirect(
      "error",
      "/admin/users",
      "Failed to update user profile"
    );
  }

  // Update user_roles table
  const { error: roleError } = await supabase
    .from('user_roles')
    .update({ 
      role,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (roleError) {
    return encodedRedirect(
      "error",
      "/admin/users",
      "Failed to update user role"
    );
  }

  return encodedRedirect(
    "success",
    "/admin/users",
    "User profile updated successfully"
  );
}

export async function impersonateUser(formData: FormData) {
  try {
    const userId = formData.get('userId') as string;
    if (!userId) {
      throw new Error('No user ID provided');
    }

    const session = await startImpersonationUtil(userId);
    
    // Simplified success message
    return encodedRedirect(
      "success",
      "/dashboard",
      `Now viewing as ${session.impersonated?.email}`
    );
  } catch (error) {
    console.error('[Impersonation] Failed to start:', error);
    return encodedRedirect(
      "error",
      "/admin/users",
      error instanceof Error ? error.message : 'Failed to impersonate user'
    );
  }
}

export async function stopImpersonation() {
  try {
    console.log('[Action] Stopping impersonation');
    await stopImpersonationUtil();
    console.log('[Action] Successfully stopped impersonation');
    
    // Don't treat the redirect as an error
    return encodedRedirect(
      "success",
      "/admin/users",
      "Stopped impersonation"
    );
  } catch (error) {
    console.error('[Action] Failed to stop impersonation:', error);
    throw error; // Let Next.js handle the error
  }
}
