# .gitignore

```
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

```

# actions/admin.ts

```ts
"use server";

import { encodedRedirect } from "@/utils/utils";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { startImpersonation, stopImpersonation as stopImpersonationUtil } from "@/lib/data/supabase/impersonation";

export async function adminOnlyAction() {
  const supabase = await createServerSupabaseClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', session.user.id)
    .single();
    
  if (roleData?.role !== 'admin') {
    throw new Error('Unauthorized');
  }
}

export async function updateUserRole(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  
  // Check if current user is admin
  const currentUser = await supabase.auth.getUser();
  if (!currentUser.data.user?.id) {
    return encodedRedirect("error", "/admin/users", "User not found");
  }

  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', currentUser.data.user.id)
    .single();
    
  if (currentUserRole?.role !== 'admin') {
    return encodedRedirect("error", "/admin/users", "Only admins can update user roles");
  }
  
  const userId = formData.get('userId') as string;
  const newRole = formData.get('role') as 'admin' | 'user' | 'guest';
  
  const { error } = await supabase
    .from('user_roles')
    .update({ 
      role: newRole,
      updated_at: new Date().toISOString(),
      updated_by: currentUser.data.user.id
    })
    .eq('id', userId);

  if (error) {
    return encodedRedirect("error", "/admin/users", "Failed to update user role");
  }

  return encodedRedirect("success", "/admin/users", "User role updated successfully");
}

export async function impersonateUser(formData: FormData) {
  try {
    const userId = formData.get('userId') as string;
    if (!userId) {
      throw new Error('No user ID provided');
    }

    const session = await startImpersonation(userId);
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
    
    return encodedRedirect("success", "/admin/users", "Stopped impersonation");
  } catch (error) {
    console.error('[Action] Failed to stop impersonation:', error);
    throw error;
  }
}

export async function createTenant(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  
  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return encodedRedirect("error", "/admin/tenants", "User not found");
  }

  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (currentUserRole?.role !== 'admin') {
    return encodedRedirect("error", "/admin/tenants", "Only admins can create tenants");
  }
  
  const name = formData.get('name') as string;
  const adminEmail = formData.get('admin_email') as string;
  
  // Start a transaction
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ 
      name,
      admin_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (tenantError) {
    return encodedRedirect("error", "/admin/tenants", "Failed to create tenant");
  }

  // Update the admin's profile with the tenant_id
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      tenant_id: tenant.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (profileError) {
    return encodedRedirect("error", "/admin/tenants", "Failed to update admin profile");
  }

  return encodedRedirect("success", "/admin/tenants", "Tenant created successfully");
}

export async function updateTenantAdmin(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  
  const tenantId = formData.get('tenant_id') as string;
  const newAdminId = formData.get('admin_id') as string;
  
  // Start a transaction
  const { error: tenantError } = await supabase
    .from('tenants')
    .update({ 
      admin_id: newAdminId,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantId);

  if (tenantError) {
    return encodedRedirect("error", "/admin/tenants", "Failed to update tenant admin");
  }

  // Update the new admin's profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      tenant_id: tenantId,
      updated_at: new Date().toISOString()
    })
    .eq('id', newAdminId);

  if (profileError) {
    return encodedRedirect("error", "/admin/tenants", "Failed to update admin profile");
  }

  return encodedRedirect("success", "/admin/tenants", "Tenant admin updated successfully");
} 
```

# actions/auth.ts

```ts
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
```

# actions/subscription.ts

```ts
"use server";

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const AUDIENCE_ID = 'c062a18b-e07a-4426-89b1-c4945d1ae371';

export async function subscribeAction(formData: FormData) {
  const email = formData.get('email')?.toString();

  if (!email) {
    return { error: "Email is required" };
  }

  try {
    await resend.contacts.create({
      email,
      audienceId: AUDIENCE_ID,
      unsubscribed: false
    });

    return { success: "Thanks for subscribing! We'll keep you updated." };
  } catch (error) {
    console.error('Subscription error:', error);
    return { error: "Failed to subscribe. Please try again later." };
  }
} 
```

# actions/tenant/create.ts

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { Database } from "@/lib/data/supabase/database.types";
import { adminGuard } from "@/lib/auth/guards";
import { z } from "zod";

const createTenantSchema = z.object({
  name: z.string().min(1, "Tenant name is required"),
  adminId: z.string().uuid("Invalid admin ID"),
});

export async function createTenant(formData: FormData) {
  const supabase = await createServerSupabaseClient(true);
  
  console.log('[Tenant Creation] Starting tenant creation process', {
    timestamp: new Date().toISOString(),
    formData: {
      name: formData.get('name'),
      adminId: formData.get('adminId'),
    }
  });
  
  try {
    // Parse and validate input
    console.log('[Tenant Creation] Validating input data');
    const input = createTenantSchema.parse({
      name: formData.get('name'),
      adminId: formData.get('adminId'),
    });
    console.log('[Tenant Creation] Input validation successful', { input });

    // Check if current user is admin
    console.log('[Tenant Creation] Checking admin permissions');
    const currentUser = await adminGuard();
    if (!currentUser.success) {
      console.error('[Tenant Creation] Admin check failed', {
        error: 'Not authorized',
        success: currentUser.success
      });
      redirect('/admin/tenants?error=Not authorized');
    }
    console.log('[Tenant Creation] Admin check passed', {
      userId: currentUser.data.id
    });

    // Check if tenant name already exists
    console.log('[Tenant Creation] Checking for existing tenant', {
      tenantName: input.name
    });
    const { data: existingTenant, error: existingTenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', input.name)
      .single();

    if (existingTenantError && existingTenantError.code !== 'PGRST116') {
      console.error('[Tenant Creation] Error checking existing tenant:', {
        error: existingTenantError,
        tenantName: input.name
      });
      redirect('/admin/tenants?error=Failed to check existing tenant');
    }

    if (existingTenant) {
      console.warn('[Tenant Creation] Tenant name already exists', {
        tenantName: input.name,
        existingTenantId: existingTenant.id
      });
      redirect('/admin/tenants?error=A tenant with this name already exists');
    }
    console.log('[Tenant Creation] Tenant name is available');

    // Check if user exists and verify they're not already assigned to a tenant
    console.log('[Tenant Creation] Verifying user', {
      userId: input.adminId
    });
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', input.adminId)
      .single();

    if (userError) {
      console.error('[Tenant Creation] Error fetching user profile:', {
        error: userError,
        userId: input.adminId
      });
      redirect('/admin/tenants?error=Failed to verify user');
    }

    if (userProfile.role !== 'user') {
      console.error('[Tenant Creation] Selected profile is not a user', {
        userId: input.adminId,
        actualRole: userProfile.role
      });
      redirect('/admin/tenants?error=Selected profile must be a user');
    }

    if (userProfile.tenant_id) {
      console.error('[Tenant Creation] User already assigned to tenant', {
        userId: input.adminId,
        existingTenantId: userProfile.tenant_id
      });
      redirect('/admin/tenants?error=Selected user is already assigned to a tenant');
    }

    console.log('[Tenant Creation] User verification successful');

    // Create tenant using RPC
    console.log('[Tenant Creation] Creating tenant via RPC', {
      tenantName: input.name,
      userId: input.adminId
    });
    const { data: newTenant, error: tenantError } = await supabase
      .rpc('create_tenant', {
        tenant_name: input.name,
        admin_user_id: input.adminId
      });

    if (tenantError) {
      console.error('[Tenant Creation] RPC error creating tenant:', {
        error: tenantError,
        input
      });
      redirect('/admin/tenants?error=Failed to create tenant');
    }

    console.log('[Tenant Creation] Tenant created successfully', {
      tenant: newTenant,
      timestamp: new Date().toISOString()
    });

    // Revalidate and redirect
    revalidatePath('/admin/tenants');
    redirect('/admin/tenants?success=Tenant created successfully');

  } catch (error) {
    if (error && 
        typeof error === 'object' && 
        'digest' in error && 
        typeof error.digest === 'string' && 
        error.digest.startsWith('NEXT_REDIRECT')) {
      console.log('[Tenant Creation] Successfully redirecting', {
        timestamp: new Date().toISOString(),
        redirect: error.digest.split(';')[2] // Extract the redirect URL
      });
      throw error;
    }

    // Log actual unexpected errors
    console.error('[Tenant Creation] Unexpected error:', {
      error,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });

    if (error instanceof z.ZodError) {
      console.error('[Tenant Creation] Validation error:', {
        validationErrors: error.errors,
        formData: {
          name: formData.get('name'),
          adminId: formData.get('adminId'),
        }
      });
      redirect('/admin/tenants?error=Invalid input data');
    }

    redirect('/admin/tenants?error=Failed to create tenant');
  }
} 
```

# actions/tenant/delete.ts

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { adminGuard } from "@/lib/auth/guards";

export async function deleteTenant(tenantId: string) {
  const supabase = await createServerSupabaseClient(true);
  
  console.log('[Tenant Deletion] Starting tenant deletion process for:', tenantId);
  
  try {
    // Check if current user is admin
    const currentUser = await adminGuard();
    if (!currentUser.success) {
      console.error('[Tenant Deletion] Admin check failed:', {
        error: 'Not authorized'
      });
      redirect('/admin/tenants?error=' + encodeURIComponent('Not authorized'));
    }

    // First, update all users in this tenant to have no tenant
    console.log('[Tenant Deletion] Updating user profiles');
    const { error: profilesError } = await supabase
      .from('profiles')
      .update({ tenant_id: null })
      .eq('tenant_id', tenantId);

    if (profilesError) {
      console.error('[Tenant Deletion] Profile update failed:', profilesError);
      redirect('/admin/tenants?error=Failed to update user profiles');
    }

    // Then delete the tenant
    console.log('[Tenant Deletion] Deleting tenant');
    const { error: tenantError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (tenantError) {
      console.error('[Tenant Deletion] Tenant deletion failed:', tenantError);
      redirect('/admin/tenants?error=Failed to delete tenant');
    }

    console.log('[Tenant Deletion] Tenant successfully deleted');
    
    // Revalidate the tenants page and redirect
    revalidatePath('/admin/tenants');
    
    // Log the successful redirect
    console.log('[Tenant Deletion] Redirecting after successful deletion');
    redirect('/admin/tenants?success=Tenant deleted successfully');

  } catch (error) {
    // Check if this is a Next.js redirect
    if (error && 
        typeof error === 'object' && 
        'digest' in error && 
        typeof error.digest === 'string' && 
        error.digest.startsWith('NEXT_REDIRECT')) {
      console.log('[Tenant Deletion] Successfully redirecting', {
        timestamp: new Date().toISOString(),
        redirect: error.digest.split(';')[2], // Extract the redirect URL
        tenantId
      });
      throw error;
    }

    // Log actual unexpected errors
    console.error('[Tenant Deletion] Unexpected error:', {
      error,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      tenantId
    });

    redirect('/admin/tenants?error=Failed to delete tenant');
  }
} 
```

# actions/user.ts

```ts
"use server";

import { encodedRedirect } from "@/utils/utils";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";

export async function updateUserProfile(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  
  // Check if current user is admin
  const currentUser = await supabase.auth.getUser();
  if (!currentUser.data.user?.id) {
    return encodedRedirect("error", "/admin/users", "User not found");
  }

  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', currentUser.data.user.id)
    .single();
    
  if (currentUserRole?.role !== 'admin') {
    return encodedRedirect("error", "/admin/users", "Only admins can update user profiles");
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
    return encodedRedirect("error", "/admin/users", "Failed to update user profile");
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
    return encodedRedirect("error", "/admin/users", "Failed to update user role");
  }

  return encodedRedirect("success", "/admin/users", "User profile updated successfully");
} 
```

# actions/user/create.ts

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { Database } from "@/lib/data/supabase/database.types";
import { adminGuard } from "@/lib/auth/guards";
import { z } from "zod";
import { DBUserRole } from "@/lib/data/supabase/types";

// Define input schema for better type safety
const createUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']),
  tenantId: z.string().nullable(),
});

export async function createUser(formData: FormData) {
  const supabase = await createServerSupabaseClient(true);
  
  try {
    console.log('[User Creation] Form data received:', {
      email: formData.get('email'),
      role: formData.get('role'),
      tenantId: formData.get('tenant_id')
    });

    // Validate admin access
    const currentUser = await adminGuard();
    if (!currentUser.success) {
      redirect('/admin/users?error=Unauthorized access');
    }

    // Parse and validate input
    const input = createUserSchema.parse({
      email: formData.get('email'),
      role: formData.get('role'),
      tenantId: formData.get('tenant_id'),
    });

    console.log('[User Creation] Validated input:', input);

    // Get admin's tenant if no tenant specified
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', currentUser.data.id)
      .single();

    const effectiveTenantId = input.tenantId || adminProfile?.tenant_id || null;
    console.log('[User Creation] Effective tenant ID:', effectiveTenantId);

    // Create auth user with admin privileges
    const { data: invite, error: inviteError } = await supabase.auth.admin.createUser({
      email: input.email,
      email_confirm: true,
      user_metadata: {
        tenant_id: effectiveTenantId
      }
    });

    if (inviteError) throw inviteError;
    if (!invite?.user?.id) throw new Error('No user ID returned from invite');

    console.log('[User Creation] Auth user created:', invite.user.id);

    // Cast the role to the correct type
    const userRole = input.role as DBUserRole;
    console.log('[User Creation] Casting role:', {
      originalRole: input.role,
      castedRole: userRole,
      roleType: typeof userRole
    });

    // Use a transaction for profile and role creation
    const { error: transactionError } = await supabase.rpc('create_user_profile', {
      p_user_id: invite.user.id,
      p_email: input.email,
      p_role: userRole,
      p_tenant_id: effectiveTenantId || undefined,
      p_created_by: currentUser.data.id
    });

    if (transactionError) {
      console.error('[User Creation] Transaction error:', {
        error: transactionError,
        params: {
          p_user_id: invite.user.id,
          p_email: input.email,
          p_role: userRole,
          p_tenant_id: effectiveTenantId || undefined,
          p_created_by: currentUser.data.id
        }
      });
      // Cleanup auth user if profile creation fails
      await supabase.auth.admin.deleteUser(invite.user.id);
      throw transactionError;
    }

    console.log('[User Creation] Profile created successfully');

    // Send password reset email
    await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: input.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/protected/reset-password`
      }
    });

    // Revalidate the users page and redirect
    revalidatePath('/admin/users');
    redirect('/admin/users?success=User created successfully');

  } catch (error) {
    console.error('[User Creation] Error:', error);
    
    // Check if it's a redirect error (ensure error is an object with digest property)
    if (error && 
        typeof error === 'object' && 
        'digest' in error && 
        typeof error.digest === 'string' && 
        error.digest.startsWith('NEXT_REDIRECT')) {
      // This is an intentional redirect, not an error
      throw error;
    }
    
    if (error instanceof z.ZodError) {
      redirect('/admin/users?error=Invalid input data');
    }

    redirect('/admin/users?error=Failed to create user');
  }
} 
```

# actions/user/delete.ts

```ts
"use server";

import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { adminGuard } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteUser(userId: string) {
  const supabase = await createServerSupabaseClient(true);
  
  console.log('[User Deletion] Starting user deletion process for:', userId);
  
  try {
    // Check if current user is admin
    const currentUser = await adminGuard();
    if (!currentUser.success) {
      redirect('/admin/users?error=' + encodeURIComponent(currentUser.error));
    }

    // Check if user is a tenant admin and update tenant if necessary
    console.log('[User Deletion] Checking for tenant admin status');
    const { data: adminTenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('admin_id', userId);

    if (adminTenants && adminTenants.length > 0) {
      console.log('[User Deletion] User is admin for tenants:', adminTenants);
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({ 
          admin_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('admin_id', userId);

      if (tenantError) {
        console.error('[User Deletion] Failed to update tenant admin:', tenantError);
        redirect('/admin/users?error=Failed to update tenant admin');
      }
    }

    // Delete in correct order
    console.log('[User Deletion] Deleting user role');
    const { error: roleError } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', userId);

    if (roleError) {
      console.error('[User Deletion] Role deletion failed:', roleError);
      redirect('/admin/users?error=Failed to delete user role');
    }

    console.log('[User Deletion] Deleting user profile');
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('[User Deletion] Profile deletion failed:', profileError);
      redirect('/admin/users?error=Failed to delete user profile');
    }

    console.log('[User Deletion] Deleting auth user');
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('[User Deletion] Auth user deletion failed:', authError);
      redirect('/admin/users?error=Failed to delete user');
    }

    console.log('[User Deletion] User successfully deleted');
    
    // Revalidate both users and tenants pages since tenant data might have changed
    revalidatePath('/admin/users');
    revalidatePath('/admin/tenants');
    redirect('/admin/users?success=User deleted successfully');

  } catch (error) {
    console.error('[User Deletion] Error:', error);
    
    // Check if it's a redirect error
    if (error && 
        typeof error === 'object' && 
        'digest' in error && 
        typeof error.digest === 'string' && 
        error.digest.startsWith('NEXT_REDIRECT')) {
      throw error;
    }

    redirect('/admin/users?error=Failed to delete user');
  }
} 
```

# actions/utils.ts

```ts
"use server";

import { createServerSupabaseClient } from "@/lib/data/supabase/server";

export async function checkAdminRole(userId: string) {
  const supabase = await createServerSupabaseClient();
  
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userId)
    .single();
    
  return roleData?.role === 'admin';
} 
```

# app/admin/dashboard/page.tsx

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createServerSupabaseClient } from "@/lib/data/supabase/server"
import { Users, UserCheck, UserPlus, ArrowUpRight } from "lucide-react"

export default async function AdminDashboard() {
  const supabase = await createServerSupabaseClient()
  
  const { data: stats } = await supabase
    .from('user_roles')
    .select('role')

  const totalUsers = stats?.length || 0
  const activeUsers = stats?.filter(user => user.role === 'user').length || 0
  const pendingUsers = stats?.filter(user => user.role === 'guest').length || 0

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <span className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </span>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{totalUsers}</div>
              <div className="text-xs text-muted-foreground">
                <ArrowUpRight className="h-4 w-4 inline-block" />
                +12% from last month
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{activeUsers}</div>
              <div className="text-xs text-muted-foreground">
                <ArrowUpRight className="h-4 w-4 inline-block" />
                +5% from last week
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Users</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{pendingUsers}</div>
              <div className="text-xs text-muted-foreground">
                <ArrowUpRight className="h-4 w-4 inline-block" />
                New requests
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
```

# app/admin/layout.tsx

```tsx
import { Sidebar } from "@/components/admin/sidebar"
import { createServerSupabaseClient } from "@/lib/data/supabase/server"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // We can trust the user is admin because middleware handles the protection
  return (
    <div className="flex h-screen">
      <Sidebar className="w-64 hidden md:block" />
      <div className="flex-1 flex flex-col">
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
} 
```

# app/admin/tenants/page.tsx

```tsx
"use client";

import { withAdminProtection } from "@/components/hoc/with-admin-protection";
import { ImpersonationWrapper } from "@/components/layouts/impersonation-wrapper";
import { createClientSupabaseClient } from "@/lib/data/supabase/client";
import { TenantsDataTable } from "@/components/admin/tenant/tenants-table";
import { useEffect, useState } from "react";
import { Database } from "@/lib/data/supabase/database.types";
import { useSearchParams } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { CreateTenantDialog } from "@/components/admin/tenant/create-tenant-dialog";

// Define types for the data structure returned from Supabase
type TenantWithProfile = {
  id: string;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  admin_id: string;
  profiles: {
    email: string;
    role: Database['public']['Enums']['user_role'] | null;
  } | null;
};

// Define the shape of processed tenant data for the UI
interface TenantWithAdmin {
  tenant_id: string;
  tenant_name: string;
  tenant_created_at: string;
  tenant_updated_at: string;
  admin_id: string;
  admin_email: string;
  admin_role: string;
  user_count: number;
}

function TenantsPage() {
  const [tenants, setTenants] = useState<TenantWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Add a refresh key state
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Show success/error messages from URL params
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      toast({
        title: "Success",
        description: success,
      });
      // Trigger refresh when success message is shown
      setRefreshKey(prev => prev + 1);
    }

    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    const fetchTenants = async () => {
      const supabase = createClientSupabaseClient();
      
      try {
        // Fetch tenants with admin info
        const { data: tenantsData, error: tenantsError } = await supabase
          .from('tenants')
          .select(`
            id,
            name,
            created_at,
            updated_at,
            admin_id,
            profiles!tenants_admin_id_fkey (
              email,
              role
            )
          `);

        if (tenantsError) throw tenantsError;
        if (!tenantsData) return;

        // Get user count for each tenant
        const tenantsWithCounts = await Promise.all(
          (tenantsData as TenantWithProfile[]).map(async (tenant) => {
            const { count } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', tenant.id);

            // Transform the data into the expected format
            return {
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              tenant_created_at: tenant.created_at || new Date().toISOString(),
              tenant_updated_at: tenant.updated_at || new Date().toISOString(),
              admin_id: tenant.admin_id,
              admin_email: tenant.profiles?.email || 'No admin email',
              admin_role: tenant.profiles?.role || 'user',
              user_count: count || 0
            } satisfies TenantWithAdmin;
          })
        );

        setTenants(tenantsWithCounts);
      } catch (error) {
        console.error('Error fetching tenants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, [refreshKey]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manage Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage tenant organizations.
          </p>
        </div>
        <CreateTenantDialog />
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : (
        <TenantsDataTable data={tenants} />
      )}
    </div>
  );
}

// Wrap the page with admin protection
export default withAdminProtection(function AdminTenantsPage() {
  return (
    <ImpersonationWrapper>
      <TenantsPage />
    </ImpersonationWrapper>
  );
});

```

# app/admin/users/page.tsx

```tsx
"use client";

import { withAdminProtection } from "@/components/hoc/with-admin-protection";
import { createClientSupabaseClient } from "@/lib/data/supabase/client";
import { UserRoleWithAuth } from '@/lib/data/supabase/types'
import { createUserColumns } from "@/components/admin/user/users-table"
import { DataTablePage } from "@/components/layouts/data-table-page";
import { Database } from "@/lib/data/supabase/database.types";
import { CreateUserDialog } from "@/components/admin/user/create-user-dialog";
import { useSearchParams } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { deleteUser } from "@/actions/user/delete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ProfileWithTenant = Database['public']['Tables']['profiles']['Row'] & {
  tenants: Database['public']['Tables']['tenants']['Row'] | null;
};

function UsersPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [userToDelete, setUserToDelete] = useState<UserRoleWithAuth | null>(null);
  
  // Handle URL parameters for success/error messages
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success) {
      toast({
        title: "Success",
        description: decodeURIComponent(success),
        variant: "default",
      });
    }
    
    if (error) {
      toast({
        title: "Error",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  const fetchUsers = async (): Promise<UserRoleWithAuth[]> => {
    const supabase = createClientSupabaseClient();
    
    const [_, usersResponse] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('profiles')
        .select(`
          id,
          email,
          role,
          updated_at,
          metadata,
          raw_user_meta_data,
          tenant_id,
          tenants!fk_profiles_tenant_id ( 
            id,
            name
          )
        `)
    ]);

    const { data: usersData, error: usersError } = usersResponse;
    if (usersError) throw usersError;
    if (!usersData) return [];

    return (usersData as ProfileWithTenant[]).map(user => ({
      id: user.id,
      email: user.email,
      role: user.role || 'guest',
      updated_at: user.updated_at,
      raw_user_meta_data: user.raw_user_meta_data,
      metadata: {
        ...(user.metadata as Record<string, any> || {}),
        tenant_name: user.tenants?.name || 'No Tenant'
      },
      tenants: user.tenants,
      tenant_id: user.tenant_id
    }));
  }

  const handleDelete = async (user: UserRoleWithAuth) => {
    setUserToDelete(user);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      const result = await deleteUser(userToDelete.id);
      // Let Next.js handle the redirect
      throw result;
    } catch (error) {
      if (error && 
          typeof error === 'object' && 
          'digest' in error && 
          typeof (error as { digest: string }).digest === 'string' && 
          (error as { digest: string }).digest.includes('success')) {
        // This is a success redirect, let Next.js handle it
        throw error;
      }
      
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
      throw error;
    } finally {
      setUserToDelete(null);
    }
  };

  const columns = createUserColumns(
    (user) => console.log('Edit', user),
    handleDelete
  );

  return (
    <>
      <DataTablePage<UserRoleWithAuth, any>
        title="Manage Users"
        description="View and manage user accounts across all tenants."
        columns={columns}
        data={[]}
        fetchData={fetchUsers}
        searchKey="email"
        searchPlaceholder="Filter users..."
        headerMetrics={
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              Total users: {0}
            </p>
            <CreateUserDialog />
          </div>
        }
        storageKey="users-table-state"
      />

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.email}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default withAdminProtection(UsersPage); 
```

# app/auth/callback/route.ts

```ts
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { NextResponse } from "next/server";
import { ROLE_ROUTES } from '@/lib/data/supabase/routes'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (!code) {
    console.log('[Auth/Callback] No code provided, redirecting to sign-in');
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const supabase = await createServerSupabaseClient();
  
  try {
    // Exchange code for session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error('[Auth/Callback] Code exchange error:', exchangeError);
      throw exchangeError;
    }

    // Get user after successful code exchange
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('[Auth/Callback] User fetch error:', userError);
      throw userError;
    }

    if (!user) {
      console.error('[Auth/Callback] No user found after code exchange');
      throw new Error('No user found after code exchange');
    }

    // Get user role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError) {
      console.error('[Auth/Callback] Role fetch error:', roleError);
    }

    const userRole = roleData?.role || 'guest';
    console.log('[Auth/Callback] Redirecting user:', {
      userId: user.id,
      role: userRole,
      redirectTo: ROLE_ROUTES[userRole]
    });

    return NextResponse.redirect(`${origin}${ROLE_ROUTES[userRole]}`);

  } catch (error) {
    console.error('[Auth/Callback] Error:', error);
    return NextResponse.redirect(`${origin}/error`);
  }
}


```

# app/auth/forgot-password/page.tsx

```tsx
import { forgotPasswordAction } from "@/actions/auth";
import { AuthCard } from "@/components/common/auth-card";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function ForgotPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  return (
    <AuthCard
      headerContent={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
          <p className="text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link className="text-primary hover:underline font-medium" href="/sign-in">
              Sign in
            </Link>
          </p>
        </>
      }
    >
      <form className="flex flex-col w-full space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>
        <SubmitButton
          className="w-full"
          formAction={forgotPasswordAction}
          pendingText="Sending reset link..."
        >
          Reset Password
        </SubmitButton>
        <FormMessage message={searchParams} />
      </form>
    </AuthCard>
  );
}

```

# app/auth/layout.tsx

```tsx
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}

```

# app/auth/reset-password/page.tsx

```tsx
import { resetPasswordAction } from "@/actions/auth";
import { AuthCard } from "@/components/common/auth-card";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ResetPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  return (
    <AuthCard
      headerContent={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
          <p className="text-sm text-muted-foreground">
            Please enter your new password below.
          </p>
        </>
      }
    >
      <form className="flex flex-col w-full space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
        </div>
        <SubmitButton
          className="w-full"
          formAction={resetPasswordAction}
          pendingText="Resetting password..."
        >
          Reset password
        </SubmitButton>
        <FormMessage message={searchParams} />
      </form>
    </AuthCard>
  );
}

```

# app/auth/sign-in/page.tsx

```tsx
import { signInAction } from "@/actions/auth";
import { AuthCard } from "@/components/common/auth-card";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <AuthCard
      headerContent={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link className="text-primary hover:underline font-medium" href="/sign-up">
              Sign up
            </Link>
          </p>
        </>
      }
    >
      <form className="flex flex-col w-full space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email"
              name="email" 
              type="email"
              placeholder="you@example.com" 
              required 
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              required
            />
          </div>
        </div>
        <SubmitButton 
          className="w-full" 
          pendingText="Signing in..." 
          formAction={signInAction}
        >
          Sign in
        </SubmitButton>
        <FormMessage message={searchParams} />
      </form>
    </AuthCard>
  );
}

```

# app/auth/sign-up/page.tsx

```tsx
import { signUpAction } from "@/actions/auth";
import { AuthCard } from "@/components/common/auth-card";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Signup(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  if ("message" in searchParams) {
    return (
      <div className="w-full flex items-center justify-center gap-2">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  return (
    <AuthCard
      headerContent={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Sign up</h1>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="text-primary hover:underline font-medium" href="/sign-in">
              Sign in
            </Link>
          </p>
        </>
      }
    >
      <form className="flex flex-col w-full space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email"
              name="email" 
              type="email"
              placeholder="you@example.com" 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
        </div>
        <SubmitButton 
          className="w-full" 
          formAction={signUpAction} 
          pendingText="Signing up..."
        >
          Sign up
        </SubmitButton>
        <FormMessage message={searchParams} />
      </form>
    </AuthCard>
  );
}

```

# app/dashboard/layout.tsx

```tsx

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (

      <div className="min-h-screen bg-gray-50">
        {children}
      </div>

  );
} 
```

# app/dashboard/page.tsx

```tsx
export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p>Welcome to your dashboard</p>
      </div>
    </div>
  );
} 
```

# app/error.tsx

```tsx
'use client'

import { Button } from "@/components/ui/button"
import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-2">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <Button
        onClick={() => reset()}
        variant="outline"
      >
        Try again
      </Button>
    </div>
  )
} 
```

# app/favicon.ico

This is a binary file of the type: Binary

# app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 0% 83.1%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

```

# app/layout.tsx

```tsx
import { ThemeProvider } from "next-themes";
import { GeistSans } from "geist/font/sans";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";
import { ImpersonationWrapper } from "@/components/layouts/impersonation-wrapper";
import { Toaster } from "@/components/ui/toaster";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { UserRole } from "@/lib/data/supabase/types";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Focus on your calling",
  description: "We provide small churches with a simple, all-in-one platform that handles their complete digital presence, so pastors can focus on ministry instead of managing technology.",
  icons: {
    icon: [
      {
        url: "/favicon.png",
        href: "/favicon.png",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let userRole: UserRole | undefined;
  if (user) {
    const { data: roleData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    userRole = roleData?.role as UserRole;
  }

  return (
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ImpersonationWrapper>
            <div className="flex flex-col min-h-screen">
              <SiteHeader user={user} initialRole={userRole} />
              <main className="flex-grow">
                {children}
              </main>
            </div>
          </ImpersonationWrapper>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

```

# app/loading.tsx

```tsx
export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
} 
```

# app/page.tsx

```tsx
import { SubscribeForm } from "@/components/subscribe-form";

export default function Home() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center min-h-screen text-center px-4">
      <div className="max-w-3xl">
        <h1 className="text-6xl font-bold mb-8">
          Focus on your calling,<br/>
          not technology.
        </h1>
        <p className="text-xl text-foreground/80 mb-12">
          We provide small churches with a simple, all-in-one platform that handles 
          their complete digital presence, so pastors can focus on ministry instead of 
          managing technology.
        </p>
        <div className="flex flex-col items-center gap-4">
          <SubscribeForm />
          <p className="text-sm text-muted-foreground">
            Be the first to know when we launch
          </p>
        </div>
      </div>
    </div>
  );
}

```

# app/public/favicon.png

This is a binary file of the type: Image

# app/public/logo.svg

This is a file of the type: SVG Image

# components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}

```

# components/admin/sidebar.tsx

```tsx
'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart,
  LogOut,
  Building,
  Menu,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { signOutAction } from "@/actions/auth"
import { Suspense, useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useState, useEffect } from "react"
import { UserRole } from "@/lib/data/supabase/types"
import { createClientSupabaseClient } from "@/lib/data/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  disabled?: boolean
  role?: UserRole | UserRole[]
}

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    role: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
    role: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  },
  {
    title: "Tenants",
    href: "/admin/tenants",
    icon: Building,
    role: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart,
    disabled: true,
    role: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

function NavLink({ 
  item, 
  pathname,
  onNavigate,
}: { 
  item: NavItem
  pathname: string
  onNavigate?: () => void
}) {
  if (item.disabled) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start opacity-50 cursor-not-allowed"
        disabled
      >
        <item.icon className="mr-2 h-4 w-4" />
        {item.title}
      </Button>
    )
  }

  return (
    <Link 
      href={item.href}
      onClick={onNavigate}
      className="w-full"
    >
      <Button
        variant={pathname === item.href ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start",
          pathname === item.href && "bg-primary/10 dark:bg-primary/20",
        )}
      >
        <item.icon className="mr-2 h-4 w-4" />
        {item.title}
        {item.href === pathname && (
          <span className="ml-auto h-1 w-1 rounded-full bg-primary" />
        )}
      </Button>
    </Link>
  )
}

function SidebarContent({ 
  pathname,
  onNavigate,
}: { 
  pathname: string
  onNavigate?: () => void
}) {
  const [userRole, setUserRole] = useState<UserRole>()
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        setIsLoading(true)
        const supabase = createClientSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          
          if (error) throw error
          setUserRole(profileData?.role as UserRole)
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
        toast({
          title: "Error",
          description: "Failed to fetch user role",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserRole()
  }, [toast])

  // Memoize filtered items
  const filteredNavItems = useMemo(() => {
    return mainNavItems.filter(item => {
      if (!item.role) return true
      if (!userRole) return true
      return Array.isArray(item.role)
        ? item.role.includes(userRole)
        : item.role === userRole
    })
  }, [userRole])

  if (isLoading) {
    return <SidebarSkeleton />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-2 px-2">
          <div className="flex items-center gap-2 font-semibold text-xl">
            <LayoutDashboard className="h-6 w-6" />
            <span>Admin Panel</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <Suspense fallback={<SidebarSkeleton />}>
          <div className="space-y-1">
            {filteredNavItems.map((item: NavItem) => (
              <NavLink 
                key={item.href}
                item={item} 
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </Suspense>
      </ScrollArea>

      <div className="border-t p-4">
        <form action={signOutAction}>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            type="submit"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  )
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  onNavigate?: () => void
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div 
      className={cn(
        "flex flex-col h-full border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <SidebarContent 
        pathname={pathname}
        onNavigate={onNavigate}
      />
    </div>
  )
} 
```

# components/admin/tenant/create-tenant-dialog.tsx

```tsx
"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { createTenant } from "@/actions/tenant/create"
import { createClientSupabaseClient } from "@/lib/data/supabase/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  name: z.string().min(1, "Tenant name is required"),
  adminId: z.string().uuid("Invalid admin ID"),
})

export function CreateTenantDialog() {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<{ id: string; email: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  
  // Fetch available users
  useEffect(() => {
    const fetchUsers = async () => {
      const supabase = createClientSupabaseClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'user')
        .is('tenant_id', null)
      
      if (data) {
        setUsers(data)
      }
    }
    
    if (open) {
      fetchUsers()
    }
  }, [open])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      adminId: "",
    },
  })

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', values.name)
      formData.append('adminId', values.adminId)
      
      await createTenant(formData)
      
      // Reset form and close dialog before refresh
      form.reset()
      setOpen(false)
      
      // Refresh the page data
      router.refresh()
    } catch (error) {
      if (error && 
          typeof error === 'object' && 
          'digest' in error && 
          typeof (error as { digest: string }).digest === 'string' && 
          (error as { digest: string }).digest.includes('success')) {
        // Success redirect, close the dialog
        form.reset()
        setOpen(false)
        throw error
      }
      
      console.error('Error creating tenant:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Tenant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Tenant</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenant Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter tenant name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="adminId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenant User</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={isLoading || form.formState.isSubmitting}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Tenant'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
} 
```

# components/admin/tenant/tenants-table.tsx

```tsx
"use client"

import { useMemo, useState, useEffect } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Users, Pencil, Eye, Trash2, Loader2 } from "lucide-react"
import { DataTable } from "@/components/ui/data-table/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { deleteTenant } from "@/actions/tenant/delete"
import { useRouter, useSearchParams } from "next/navigation"

interface TenantData {
  tenant_id: string
  tenant_name: string
  tenant_created_at: string
  tenant_updated_at: string
  admin_id: string
  admin_email: string
  admin_role: string
  user_count: number
}

export function TenantsDataTable({ data }: { data: TenantData[] }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<TenantData | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Reset dialog state when the page refreshes with a success message
  useEffect(() => {
    if (searchParams.get('success')?.includes('deleted')) {
      setIsDeleting(false)
      setIsDeleteLoading(false)
      setSelectedTenant(null)
    }
  }, [searchParams])

  const handleEdit = (tenant: TenantData) => {
    setSelectedTenant(tenant)
    setIsEditing(true)
  }

  const handleDelete = (tenant: TenantData) => {
    setSelectedTenant(tenant)
    setIsDeleting(true)
  }

  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!selectedTenant) return
    
    setIsDeleteLoading(true)
    try {
      const result = await deleteTenant(selectedTenant.tenant_id)
      router.refresh()
      
      // Keep the loading state active until the page refreshes
      throw result
    } catch (error) {
      if (error && 
          typeof error === 'object' && 
          'digest' in error && 
          typeof (error as { digest: string }).digest === 'string' && 
          (error as { digest: string }).digest.includes('success')) {
        // Keep dialog open and loading state active
        throw error
      }
      
      // Only reset states on actual error
      setIsDeleteLoading(false)
      setIsDeleting(false)
      setSelectedTenant(null)
      
      toast({
        title: "Error",
        description: "Failed to delete tenant",
        variant: "destructive",
      })
    }
  }

  const columns = useMemo<ColumnDef<TenantData>[]>(() => [
    {
      id: "tenant_name",
      accessorKey: "tenant_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tenant Name" />
      ),
    },
    {
      id: "admin_email",
      accessorKey: "admin_email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Admin Email" />
      ),
    },
    {
      id: "user_count",
      accessorKey: "user_count",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Users" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {row.original.user_count}
        </div>
      ),
    },
    {
      id: "tenant_created_at",
      accessorKey: "tenant_created_at",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: ({ row }) => formatDate(row.original.tenant_created_at),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const tenant = row.original
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Add your view action here
                console.log("View tenant:", tenant)
              }}
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">View</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(tenant)}
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(tenant)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        )
      }
    }
  ], [])

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchKey="tenant_name"
        searchPlaceholder="Filter tenants..."
        pageSize={10}
      />

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            // Add your tenant update logic here
            setIsEditing(false)
            toast({
              title: "Success",
              description: "Tenant updated successfully",
            })
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tenant_name">Tenant Name</Label>
                <Input
                  id="tenant_name"
                  name="tenant_name"
                  defaultValue={selectedTenant?.tenant_name}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admin_email">Admin Email</Label>
                <Input
                  id="admin_email"
                  name="admin_email"
                  defaultValue={selectedTenant?.admin_email}
                  type="email"
                  disabled
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog 
        open={isDeleting} 
        onOpenChange={(open) => {
          // Only allow closing if not loading
          if (!isDeleteLoading) {
            setIsDeleting(open)
            if (!open) {
              setSelectedTenant(null)
            }
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTenant?.tenant_name}? This action cannot be undone.
              All users in this tenant will be unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={isDeleteLoading}
              onClick={(e) => {
                e.preventDefault()
                if (!isDeleteLoading) {
                  setIsDeleting(false)
                  setSelectedTenant(null)
                }
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleteLoading}
            >
              {isDeleteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 
```

# components/admin/user/create-user-dialog.tsx

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createUser } from "@/actions/user/create";

export function CreateUserDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
        </DialogHeader>
        <form action={createUser} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select name="role" defaultValue="user">
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tenant_id">Tenant</Label>
            {/* Add tenant selection here */}
          </div>
          <Button type="submit" className="w-full">Send Invite</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
} 
```

# components/admin/user/users-table.tsx

```tsx
"use client"

import { useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Building, Pencil, Eye, Trash2 } from "lucide-react"
import { UserRoleWithAuth } from "@/lib/data/supabase/types"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header"
import { impersonateUser } from "@/actions/admin"
import { useTableHandlers } from "@/hooks/use-table-handlers"

// Create a function to generate columns
export function createUserColumns(
  onEdit: (user: UserRoleWithAuth) => void,
  onDelete: (user: UserRoleWithAuth) => void
): ColumnDef<UserRoleWithAuth>[] {
  return [
    {
      id: "email",
      accessorFn: (row) => row.email,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
    },
    {
      id: "role",
      accessorFn: (row) => row.role,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
    },
    {
      id: "tenant",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tenant" />
      ),
      cell: ({ row }) => {
        const tenant = row.original.metadata?.tenant_name || 'No Tenant'
        return (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            <span>{tenant}</span>
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(user)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(user)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      }
    }
  ]
}

export function UsersDataTable({ data }: { data: UserRoleWithAuth[] }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRoleWithAuth | null>(null)
  const { handleEdit, handleDelete, isPending } = useTableHandlers<UserRoleWithAuth>()

  const columns = useMemo(
    () => createUserColumns(
      (user) => {
        setSelectedUser(user)
        setIsEditing(true)
      },
      (user) => {
        setSelectedUser(user)
        setIsDeleting(true)
      }
    ),
    []
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="email"
      searchPlaceholder="Filter emails..."
      pageSize={10}
      deleteAction={async (user) => {
        await handleDelete(user, async (userData) => {
          // Implement your delete logic here
          console.log("Deleting user:", userData)
        })
      }}
      editAction={async (user) => {
        await handleEdit(user, async (userData) => {
          // Implement your edit logic here
          console.log("Editing user:", userData)
        })
      }}
      viewAction={(user) => {
        // View user logic
        console.log("View user:", user)
      }}
      deleteModalTitle="Delete User"
      deleteModalDescription="This will permanently delete the user account and remove their data from our servers."
      editModalTitle="Edit User"
    />
  )
}

// Export the column generator function instead of the columns directly
export { createUserColumns as userTableColumns }
```

# components/common/auth-card.tsx

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface AuthCardProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

export function AuthCard({ children, headerContent }: AuthCardProps) {
  return (
    <Card className="w-full min-w-[320px] border-none shadow-none sm:border sm:shadow-sm">
      {headerContent && (
        <CardHeader className="space-y-2 px-6 pb-6">{headerContent}</CardHeader>
      )}
      <CardContent className="px-6 pb-6">{children}</CardContent>
    </Card>
  );
} 
```

# components/common/smtp-message.tsx

```tsx
import { ArrowUpRight, InfoIcon } from "lucide-react";
import Link from "next/link";

export function SmtpMessage() {
  return (
    <div className="bg-muted/50 px-5 py-3 border rounded-md flex gap-4">
      <InfoIcon size={16} className="mt-0.5" />
      <div className="flex flex-col gap-1">
        <small className="text-sm text-secondary-foreground">
          <strong> Note:</strong> Emails are rate limited. Enable Custom SMTP to
          increase the rate limit.
        </small>
        <div>
          <Link
            href="https://supabase.com/docs/guides/auth/auth-smtp"
            target="_blank"
            className="text-primary/50 hover:text-primary flex items-center text-sm gap-1"
          >
            Learn more <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

```

# components/form-message.tsx

```tsx
export type Message =
  | { success: string }
  | { error: string }
  | { message: string };

export function FormMessage({ message }: { message: Message }) {
  return (
    <div className="flex flex-col gap-2 w-full max-w-md text-sm">
      {"success" in message && (
        <div className="text-foreground border-l-2 border-foreground px-4">
          {message.success}
        </div>
      )}
      {"error" in message && (
        <div className="text-destructive-foreground border-l-2 border-destructive-foreground px-4">
          {message.error}
        </div>
      )}
      {"message" in message && (
        <div className="text-foreground border-l-2 px-4">{message.message}</div>
      )}
    </div>
  );
}

```

# components/header-auth.tsx

```tsx
'use client';

import { User } from '@supabase/supabase-js'
import { signOutAction } from "@/actions/auth";
import { hasEnvVars } from "@/lib/data/supabase/check-env-vars";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { ThemeSwitcher } from "./theme-switcher";
import { UserRole } from '@/lib/data/supabase/types'
import { Skeleton } from "./ui/skeleton";

interface AuthButtonProps {
  user: any // Replace with proper user type
  userRole?: UserRole
  isLoading?: boolean
}

export default function AuthButton({ user, userRole, isLoading }: AuthButtonProps) {
  if (isLoading && user) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-20" />
      </div>
    )
  }

  if (!hasEnvVars) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-sm">
          Update .env.local
        </Badge>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/sign-in">Log in</Link>
        </Button>
        <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/sign-up">Get Started</Link>
        </Button>
      </div>
    );
  }

  // Get initials from email for avatar fallback
  const initials = user.email 
    ? user.email
        .split('@')[0]
        .split('.')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
    : 'U'; // Fallback to 'U' for User if no email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative h-8 w-8 rounded-full"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.email || 'No email'}</p>
            <p className="text-xs text-muted-foreground">
              {userRole === 'admin' ? 'Admin Account' : 'User Account'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Show admin-specific menu items */}
        {userRole === 'admin' && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin">Admin Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <ThemeSwitcher />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={signOutAction} className="w-full">
            <button className="flex w-full items-center text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

```

# components/hoc/with-admin-protection.tsx

```tsx
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/data/supabase/database.types";
import { useRouter } from "next/navigation";

export function withAdminProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function AdminProtectedComponent(props: P) {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const router = useRouter();
    
    const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
      const checkAdminStatus = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/sign-in');
          return;
        }

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', user.id)
          .single();

        const isUserAdmin = roleData?.role === 'admin';
        setIsAdmin(isUserAdmin);

        if (!isUserAdmin) {
          router.push('/unauthorized');
        }
      };

      checkAdminStatus();
    }, [router, supabase]);

    if (isAdmin === null) {
      return <div>Loading...</div>; // Or your loading component
    }

    if (isAdmin === false) {
      return null; // Router will handle redirect
    }

    return <WrappedComponent {...props} />;
  };
} 
```

# components/impersonation-banner.tsx

```tsx
"use client";

import { Button } from "./ui/button";
import { stopImpersonation } from "@/actions/admin";

export function ImpersonationBanner({ adminEmail, userEmail }: { 
  adminEmail: string;
  userEmail: string;
}) {
  console.log('[ImpersonationBanner] Rendering with:', { adminEmail, userEmail });
  
  return (
    <div className="bg-yellow-100 dark:bg-yellow-900 p-2 text-sm flex justify-between items-center">
      <span>
        Viewing as <strong>{userEmail}</strong> (Admin: {adminEmail})
      </span>
      <form action={stopImpersonation}>
        <Button type="submit" variant="outline" size="sm">
          Exit Impersonation
        </Button>
      </form>
    </div>
  );
} 
```

# components/layouts/data-table-page.tsx

```tsx
"use client"

import { Suspense } from "react"
import { TableSkeleton } from "@/components/ui/data-table/table-skeleton"
import { DataTable } from "@/components/ui/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { DataTableError } from "@/components/ui/data-table/data-table-error"
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty"
import { useEffect, useState } from "react"

interface DataTablePageProps<TData, TValue> {
  // Basic props
  title: string
  description?: string
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  
  // Search and filtering
  searchKey?: string
  searchPlaceholder?: string
  filterableColumns?: {
    id: string
    title: string
    options: {
      label: string
      value: string
    }[]
  }[]

  // Loading and error states
  loading?: boolean
  error?: Error
  
  // Actions
  createAction?: () => void
  deleteAction?: (data: TData) => Promise<void>
  editAction?: (data: TData) => Promise<void>
  viewAction?: (data: TData) => void
  
  // Data fetching
  fetchData?: () => Promise<TData[]>
  refetchData?: () => Promise<void>
  
  // UI Customization
  className?: string
  headerMetrics?: React.ReactNode
  emptyState?: React.ReactNode
  customActions?: React.ReactNode
  
  // Table configuration
  pageSize?: number
  storageKey?: string
}

export function DataTablePage<TData, TValue>({
  // Destructure all props
  title,
  description,
  columns,
  data: initialData,
  searchKey,
  searchPlaceholder,
  filterableColumns,
  loading: externalLoading,
  error: externalError,
  createAction,
  deleteAction,
  editAction,
  viewAction,
  fetchData,
  refetchData,
  className,
  headerMetrics,
  emptyState,
  customActions,
  pageSize = 10,
  storageKey,
}: DataTablePageProps<TData, TValue>) {
  // Internal state management
  const [data, setData] = useState<TData[]>(initialData)
  const [loading, setLoading] = useState(externalLoading || false)
  const [error, setError] = useState<Error | undefined>(externalError)

  // Handle data fetching
  useEffect(() => {
    if (fetchData) {
      const loadData = async () => {
        try {
          setLoading(true)
          const newData = await fetchData()
          setData(newData)
          setError(undefined)
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Failed to fetch data'))
        } finally {
          setLoading(false)
        }
      }

      loadData()
    }
  }, [fetchData])

  // Handle data updates
  useEffect(() => {
    setData(initialData)
  }, [initialData])

  // Handle error reset
  const handleErrorReset = async () => {
    if (refetchData) {
      try {
        setLoading(true)
        await refetchData()
        setError(undefined)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch data'))
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className={cn("p-6 space-y-4", className)}>
      <div className="flex flex-col space-y-1">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {headerMetrics}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <Suspense fallback={<TableSkeleton />}>
        {error ? (
          <DataTableError error={error} reset={handleErrorReset} />
        ) : data.length === 0 && !loading ? (
          emptyState || (
            <DataTableEmpty 
              message="No results found" 
              createAction={createAction}
            />
          )
        ) : (
          <DataTable
            columns={columns}
            data={data}
            searchKey={searchKey}
            searchPlaceholder={searchPlaceholder}
            filterableColumns={filterableColumns}
            deleteAction={deleteAction}
            editAction={editAction}
            viewAction={viewAction}
            createAction={createAction}
            pageSize={pageSize}
            storageKey={storageKey}
            loadingState={loading ? <TableSkeleton /> : undefined}
          />
        )}
      </Suspense>

      {customActions}
    </div>
  )
} 
```

# components/layouts/impersonation-wrapper.tsx

```tsx
"use client";

import { useEffect, useState } from "react";
import { ImpersonationBanner } from "../impersonation-banner";
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/data/supabase/database.types";
import { usePathname } from 'next/navigation';

interface ImpersonationState {
  isLoading: boolean;
  error: Error | null;
  data: {
    admin_email: string;
    user_email: string;
  } | null;
}

export function ImpersonationWrapper({
  children
}: {
  children: React.ReactNode
}) {
  const [state, setState] = useState<ImpersonationState>({
    isLoading: true,
    error: null,
    data: null
  });

  useEffect(() => {
    const checkImpersonation = async () => {
      try {
        const sessionId = document.cookie
          .split('; ')
          .find(row => row.startsWith('impersonation_id='))
          ?.split('=')[1];

        if (!sessionId) {
          setState({ isLoading: false, error: null, data: null });
          return;
        }

        const supabase = createBrowserClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: session } = await supabase
          .from('impersonation_sessions')
          .select(`
            admin:profiles!impersonation_sessions_admin_id_fkey(email),
            impersonated:profiles!impersonation_sessions_impersonated_id_fkey(email)
          `)
          .eq('id', sessionId)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (session?.admin?.email && session?.impersonated?.email) {
          setState({
            isLoading: false,
            error: null,
            data: {
              admin_email: session.admin.email,
              user_email: session.impersonated.email
            }
          });
        } else {
          setState({ isLoading: false, error: null, data: null });
        }
      } catch (error) {
        console.error('[ImpersonationWrapper] Error:', error);
        setState({ isLoading: false, error: error as Error, data: null });
      }
    };

    // Check immediately
    checkImpersonation();

    // Set up polling
    const interval = setInterval(checkImpersonation, 5000);

    return () => clearInterval(interval);
  }, []);

  if (state.isLoading) return <>{children}</>;

  return (
    <>
      {state.data && (
        <ImpersonationBanner 
          adminEmail={state.data.admin_email}
          userEmail={state.data.user_email}
        />
      )}
      {children}
    </>
  );
} 
```

# components/logo.tsx

```tsx
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 505.11 505.11"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        className="fill-background stroke-foreground"
        d="M505.11,505.11H0V0h505.11v505.11ZM236.26,100.51c0,5.33.32,10.08-.14,14.75-.22,2.26-1.36,5.07-3.05,6.45-22.41,18.22-44.87,36.38-67.55,54.26-20.69,16.31-33.48,36.59-34.08,63.63-.04,1.84-2.04,4.38-3.81,5.32-17.08,9.07-34.46,17.56-51.43,26.83-13.85,7.56-23.63,18.92-26.61,34.8-1.53,8.18-2.2,16.62-2.26,24.95-.25,33.49-.15,66.98-.06,100.47.01,5.07.38,10.17.98,15.21,2.02,16.82,13.05,28.09,29.91,30.43,5.5.76,11.11,1.06,16.67,1.09,38.39.21,76.79.38,115.18.39,35.11.01,70.22-.21,105.34-.27,27.73-.05,55.46.01,83.19-.02,6.89,0,13.8.03,20.67-.34,20.59-1.08,32.86-10.99,36.25-29.53,1-5.45,1.26-11.1,1.28-16.66.12-32.01.12-64.02.03-96.04-.02-7.05-.36-14.11-.93-21.14-1.39-17.03-8.82-30.71-23.17-40.31-3.81-2.55-7.71-5.02-11.77-7.13-13.97-7.24-27.91-14.57-42.13-21.27-4.92-2.32-6.39-5.22-6.75-10.39-.48-6.81-1.8-13.67-3.69-20.24-4.89-17.01-16.66-29.12-29.97-39.87-22.34-18.04-44.82-35.92-67.19-53.92-1.32-1.06-3.11-2.55-3.2-3.94-.36-5.66-.15-11.35-.15-17.53,9.44,0,18.28.21,27.1-.06,8.17-.25,14.44-6.75,14.9-14.87.43-7.43-5-14.6-12.59-15.94-3.84-.68-7.83-.51-11.76-.57-5.82-.08-11.64-.02-17.69-.02,0-9.35.16-17.87-.04-26.39-.22-9.28-7.61-15.9-16.81-15.4-8.17.44-14.46,7.03-14.61,15.63-.15,8.63-.03,17.27-.03,26.16-8.58,0-16.46-.19-24.31.09-3.19.11-6.62.7-9.47,2.05-6.27,2.98-9.31,10.21-7.81,17.01,1.57,7.11,7.26,12.09,14.65,12.27,8.81.21,17.63.05,26.93.05Z"
      />
      <path
        className="fill-foreground"
        d="M236.26,100.51c-9.3,0-18.12.16-26.93-.05-7.4-.18-13.08-5.16-14.65-12.27-1.5-6.8,1.54-14.03,7.81-17.01,2.85-1.35,6.27-1.93,9.47-2.05,7.86-.28,15.73-.09,24.31-.09,0-8.89-.11-17.53.03-26.16.15-8.59,6.44-15.19,14.61-15.63,9.2-.5,16.6,6.12,16.81,15.4.2,8.52.04,17.04.04,26.39,6.06,0,11.88-.06,17.69.02,3.93.06,7.92-.11,11.76.57,7.59,1.34,13.02,8.51,12.59,15.94-.47,8.11-6.74,14.62-14.9,14.87-8.82.27-17.66.06-27.1.06,0,6.17-.21,11.87.15,17.53.09,1.39,1.89,2.88,3.2,3.94,22.37,18,44.85,35.88,67.19,53.92,13.31,10.75,25.09,22.85,29.97,39.87,1.89,6.57,3.21,13.43,3.69,20.24.36,5.17,1.83,8.08,6.75,10.39,14.23,6.7,28.16,14.03,42.13,21.27,4.06,2.11,7.96,4.58,11.77,7.13,14.36,9.59,21.78,23.28,23.17,40.31.57,7.03.91,14.09.93,21.14.09,32.01.09,64.02-.03,96.04-.02,5.56-.29,11.21-1.28,16.66-3.39,18.54-15.65,28.45-36.25,29.53-6.88.36-13.78.33-20.67.34-27.73.03-55.46-.02-83.19.02-35.11.06-70.22.28-105.34.27-38.39-.02-76.79-.18-115.18-.39-5.56-.03-11.17-.33-16.67-1.09-16.87-2.34-27.89-13.61-29.91-30.43-.61-5.04-.97-10.14-.98-15.21-.08-33.49-.18-66.98.06-100.47.06-8.33.73-16.77,2.26-24.95,2.98-15.88,12.76-27.23,26.61-34.8,16.96-9.27,34.35-17.76,51.43-26.83,1.77-.94,3.77-3.48,3.81-5.32.61-27.04,13.39-47.32,34.08-63.63,22.68-17.87,45.15-36.03,67.55-54.26,1.69-1.37,2.83-4.19,3.05-6.45.46-4.67.14-9.42.14-14.75Z"
      />
      <path
        className="fill-background"
        d="M252.21,146.98c24.35,19.74,48.27,39.19,72.27,58.55,13.57,10.95,16.89,25.88,16.87,42.24-.04,23.63.04,47.25.05,70.88.01,40.7,0,81.41,0,122.11v6.16h-31.51c0-1.68,0-3.4,0-5.13,0-20.68.13-41.36-.04-62.04-.25-30.02-21.79-54.57-50.56-57.91-35.07-4.07-64.72,22.06-65.08,57.59-.21,20.68-.04,41.36-.04,62.04,0,1.76,0,3.51,0,5.53h-31.51v-5.43c0-60.56-.06-121.12.06-181.69.02-9.32.57-18.67,1.41-27.96.8-8.83,4.82-16.51,11.43-22.28,12.1-10.57,24.53-20.75,36.98-30.91,12.95-10.56,26.09-20.9,39.67-31.76Z"
      />
      <path
        className="fill-foreground"
        d="M231.1,232.1c-.05-11.66,9.09-21.01,20.72-21.19,11.72-.18,21.36,9.41,21.3,21.16-.07,11.6-9.41,20.89-21.02,20.9-11.63,0-20.94-9.25-21-20.87Z"
      />
    </svg>
  );
} 
```

# components/site-header.tsx

```tsx
'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import AuthButton from "@/components/header-auth"
import { Logo } from "@/components/logo"
import { UserRole } from "@/lib/data/supabase/types"
import { LayoutDashboard, Menu, X } from "lucide-react"
import { Button } from "./ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useState, useEffect } from "react"
import { createClientSupabaseClient } from "@/lib/data/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Sidebar } from "./admin/sidebar"
import { DialogTitle } from "@/components/ui/dialog"

interface SiteHeaderProps {
  user: any // Replace with proper user type
  initialRole?: UserRole
  className?: string
}

export function SiteHeader({ user, initialRole, className }: SiteHeaderProps) {
  const [userRole, setUserRole] = useState<UserRole | undefined>(initialRole)
  const [isLoading, setIsLoading] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const { toast } = useToast()
  const isAdminRoute = pathname?.startsWith('/admin')

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const fetchUserRole = async () => {
      if (initialRole || !user) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const supabase = createClientSupabaseClient()
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (error) throw error
        setUserRole(profileData?.role as UserRole)
      } catch (error) {
        console.error('Error fetching user role:', error)
        toast({
          title: "Error",
          description: "Failed to fetch user role",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserRole()
  }, [user, initialRole, toast])

  return (
    <>
      <header className={cn(
        "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}>
        <div className="container flex h-14 items-center">
          <div className="flex flex-1 items-center justify-between">
            {/* Mobile Menu Button - Only show on admin routes */}
            {isAdminRoute && !isDesktop && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}

            {/* Logo */}
            <Link 
              href="/" 
              className={cn(
                "flex items-center space-x-3 font-semibold",
                isAdminRoute && "md:hidden"
              )}
            >
              <Logo className="h-8 w-8 text-foreground" />
              <span>Tiny Church</span>
            </Link>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {userRole === UserRole.ADMIN && !isAdminRoute && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
              {!user && (
                <Link href="/auth/sign-in">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
              )}
              {user && (
                <AuthButton 
                  user={user} 
                  userRole={userRole} 
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Sheet - Only show on admin routes */}
      {isAdminRoute && (
        <Sheet 
          open={isMobileMenuOpen} 
          onOpenChange={setIsMobileMenuOpen}
        >
          <SheetContent 
            side="left" 
            className="p-0 w-[280px]"
          >
            <div className="flex items-center p-4">
              <DialogTitle className="text-lg font-semibold">
                Menu
              </DialogTitle>
            </div>
            
            <Sidebar 
              className="border-none" 
              onNavigate={() => setIsMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Sidebar - Only show on admin routes */}
      {isAdminRoute && isDesktop && (
        <Sidebar className="w-64 hidden md:block fixed inset-y-0 left-0 top-[3.5rem] z-30" />
      )}
    </>
  )
} 
```

# components/submit-button.tsx

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

type Props = ComponentProps<typeof Button> & {
  pendingText?: string;
};

export function SubmitButton({
  children,
  pendingText = "Submitting...",
  ...props
}: Props) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" aria-disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

```

# components/subscribe-form.tsx

```tsx
'use client';

import { useToast } from "@/hooks/use-toast";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { subscribeAction } from "@/actions/subscription";

export function SubscribeForm() {
  const { toast } = useToast();

  return (
    <form 
      action={async (formData: FormData) => {
        const result = await subscribeAction(formData);
        if ('error' in result) {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error,
          });
        } else if ('success' in result) {
          toast({
            title: "Success",
            description: result.success,
          });
        }
      }} 
      className="flex w-full max-w-md gap-4"
    >
      <Input 
        type="email" 
        name="email"
        placeholder="Enter your email"
        className="flex-1"
        required
      />
      <SubmitButton
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        pendingText="Subscribing..."
      >
        Subscribe
      </SubmitButton>
    </form>
  );
} 
```

# components/theme-switcher.tsx

```tsx
"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex w-full items-center">
      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="flex w-full items-center"
      >
        {theme === "light" ? (
          <>
            <Moon className="mr-2 h-4 w-4" />
            <span>Dark Mode</span>
          </>
        ) : (
          <>
            <Sun className="mr-2 h-4 w-4" />
            <span>Light Mode</span>
          </>
        )}
      </button>
    </div>
  );
}

```

# components/ui/alert-dialog.tsx

```tsx
"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      "mt-2 sm:mt-0",
      className
    )}
    {...props}
  />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}

```

# components/ui/alert.tsx

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }

```

# components/ui/avatar.tsx

```tsx
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarFallback } 
```

# components/ui/badge.tsx

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

```

# components/ui/button.tsx

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

```

# components/ui/card.tsx

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

```

# components/ui/checkbox.tsx

```tsx
"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };

```

# components/ui/data-table/data-table-column-header.tsx

```tsx
import { Column } from "@tanstack/react-table"
import { ArrowUpDown, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
          >
            <span>{title}</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            Desc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff className="mr-2 h-4 w-4" />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
} 
```

# components/ui/data-table/data-table-empty.tsx

```tsx
"use client"

import { FileX } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DataTableEmptyProps {
  message?: string
  createAction?: () => void
}

export function DataTableEmpty({ 
  message = "No results found",
  createAction
}: DataTableEmptyProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <FileX className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{message}</h3>
      <p className="mb-4 mt-2 text-sm text-muted-foreground">
        We couldn't find any matching records.
      </p>
      {createAction && (
        <Button onClick={createAction} size="sm">
          Create New
        </Button>
      )}
    </div>
  )
} 
```

# components/ui/data-table/data-table-error.tsx

```tsx
"use client"

import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function DataTableError({ error, reset }: { 
  error: Error
  reset: () => void 
}) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="mt-1 flex items-center justify-between">
        <span>{error.message || "Something went wrong"}</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={reset}
          className="ml-2"
        >
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  )
} 
```

# components/ui/data-table/data-table-header.tsx

```tsx
"use client"

import { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"
import { PlusCircle } from "lucide-react"

interface DataTableHeaderProps<TData> {
  table: Table<TData>
  title?: string
  description?: string
  createAction?: () => void
}

export function DataTableHeader<TData>({
  table,
  title,
  description,
  createAction,
}: DataTableHeaderProps<TData>) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        {title && <h2 className="text-2xl font-bold tracking-tight">{title}</h2>}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {createAction && (
          <Button onClick={createAction} size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New
          </Button>
        )}
      </div>
    </div>
  )
} 
```

# components/ui/data-table/data-table-pagination.tsx

```tsx
"use client"

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-ui/react-icons"
import { Button } from "@/components/ui/button"
import { DataTablePaginationProps } from "@/types/data-table"

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 text-sm text-muted-foreground">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
} 
```

# components/ui/data-table/data-table-toolbar.tsx

```tsx
"use client"

import { useCallback } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { X, PlusCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTableViewOptions } from "./data-table-view-options"
import { DataTableToolbarProps } from "@/types/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder,
  filterableColumns,
  headerActions,
  createAction
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  const handleSearch = useDebouncedCallback((value: string) => {
    if (searchKey) {
      table.getColumn(searchKey)?.setFilterValue(value)
    }
  }, 300)

  const resetFilters = useCallback(() => {
    table.resetColumnFilters()
  }, [table])

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-1 items-center space-x-2">
          {searchKey && (
            <div className="relative w-full md:w-[250px]">
              <Input
                placeholder={searchPlaceholder}
                onChange={(event) => handleSearch(event.target.value)}
                className="h-9 w-full"
              />
              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={resetFilters}
                  className="absolute right-0 top-0 h-9 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {filterableColumns?.map(({ id, title, options }) => (
              <Select
                key={id}
                onValueChange={(value) => {
                  table.getColumn(id)?.setFilterValue(value)
                }}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder={title} />
                </SelectTrigger>
                <SelectContent>
                  {options.map(({ label, value }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {createAction && (
            <Button 
              onClick={createAction}
              className="h-9"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New
            </Button>
          )}
          {headerActions}
          <DataTableViewOptions table={table} />
        </div>
      </div>
    </div>
  )
} 
```

# components/ui/data-table/data-table-view-options.tsx

```tsx
"use client"

import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Table } from "@tanstack/react-table"
import { Settings2 } from "lucide-react"

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>
}

export function DataTableViewOptions<TData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 lg:flex"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== "undefined" && column.getCanHide()
          )
          .map((column) => {
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {column.id}
              </DropdownMenuCheckboxItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 
```

# components/ui/data-table/data-table.tsx

```tsx
"use client"

import * as React from "react"
import { useCallback, useMemo } from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Suspense } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTableToolbar } from "./data-table-toolbar"
import { DataTablePagination } from "./data-table-pagination"
import { DataTableProps } from "@/types/data-table"
import { TableSkeleton } from "./table-skeleton"

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Filter...",
  pageSize = 10,
  pageSizeOptions = [10, 20, 30, 40, 50],
  deleteAction,
  editAction,
  viewAction,
  deleteModalTitle = "Are you absolutely sure?",
  deleteModalDescription = "This action cannot be undone.",
  editModalTitle = "Edit Item",
  loadingState,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [isEditing, setIsEditing] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [selectedItem, setSelectedItem] = React.useState<TData | null>(null)

  // Memoized handlers
  const handleEdit = useCallback((item: TData) => {
    setSelectedItem(item)
    setIsEditing(true)
  }, [])

  const handleDelete = useCallback((item: TData) => {
    setSelectedItem(item)
    setIsDeleting(true)
  }, [])

  const handleView = useCallback((item: TData) => {
    if (viewAction) {
      viewAction(item)
    }
  }, [viewAction])

  // Memoize core table functions
  const getCoreRowModelMemo = useCallback(getCoreRowModel(), [])
  const getFilteredRowModelMemo = useCallback(getFilteredRowModel(), [])
  const getPaginationRowModelMemo = useCallback(getPaginationRowModel(), [])
  const getSortedRowModelMemo = useCallback(getSortedRowModel(), [])

  // Memoize table state
  const tableState = useMemo(
    () => ({
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    }),
    [sorting, columnFilters, columnVisibility, rowSelection]
  )

  // Create table instance with proper typing
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(data.length / pageSize),
    state: tableState,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModelMemo,
    getFilteredRowModel: getFilteredRowModelMemo,
    getPaginationRowModel: getPaginationRowModelMemo,
    getSortedRowModel: getSortedRowModelMemo,
  })

  // Memoize row rendering function
  const renderRows = useCallback(
    () => (
      <TableBody>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext()
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center"
            >
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    ),
    [table, columns]
  )

  return (
    <div className="space-y-4">
      <DataTableToolbar<TData>
        table={table}
        searchKey={searchKey}
        searchPlaceholder={searchPlaceholder}
      />
      <Suspense fallback={loadingState || <TableSkeleton />}>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            {renderRows()}
          </Table>
        </div>
      </Suspense>
      <DataTablePagination<TData> table={table} />

      {editAction && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editModalTitle}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-end gap-2 py-3">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedItem || !editAction) return
                  try {
                    await editAction(selectedItem)
                    setIsEditing(false)
                    toast({
                      title: "Success",
                      description: "Item updated successfully",
                    })
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to update item",
                      variant: "destructive",
                    })
                  }
                }}
              >
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {deleteAction && (
        <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteModalTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteModalDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!selectedItem || !deleteAction) return
                  try {
                    await deleteAction(selectedItem)
                    setIsDeleting(false)
                    toast({
                      title: "Success",
                      description: "Item deleted successfully",
                    })
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to delete item",
                      variant: "destructive",
                    })
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
} 
```

# components/ui/data-table/table-skeleton.tsx

```tsx
"use client"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface TableSkeletonProps {
  columnCount?: number
  rowCount?: number
  isHeader?: boolean
}

export function TableSkeleton({
  columnCount = 5,
  rowCount = 10,
  isHeader = true
}: TableSkeletonProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-[250px]" />
          <Skeleton className="h-9 w-[180px]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-[100px]" />
          <Skeleton className="h-9 w-[80px]" />
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          {isHeader && (
            <TableHeader>
              <TableRow>
                {Array.from({ length: columnCount }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-6 w-full" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
          )}
          <TableBody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columnCount }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-[120px]" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-[80px]" />
          <Skeleton className="h-9 w-[80px]" />
        </div>
      </div>
    </div>
  )
} 
```

# components/ui/dialog.tsx

```tsx
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

```

# components/ui/dropdown-menu.tsx

```tsx
"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};

```

# components/ui/form.tsx

```tsx
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import {
  Controller,
  ControllerProps,
  FieldPath,
  FieldValues,
  FormProvider,
  useFormContext,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField()

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
})
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField()

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message) : children

  if (!body) {
    return null
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
})
FormMessage.displayName = "FormMessage"

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}

```

# components/ui/input.tsx

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

```

# components/ui/label.tsx

```tsx
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }

```

# components/ui/scroll-area.tsx

```tsx
"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }

```

# components/ui/select.tsx

```tsx
"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}

```

# components/ui/sheet.tsx

```tsx
"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

```

# components/ui/skeleton.tsx

```tsx
"use client"

import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }

```

# components/ui/table.tsx

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

```

# components/ui/toast.tsx

```tsx
"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}

```

# components/ui/toaster.tsx

```tsx
"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

```

# hooks/use-impersonation.ts

```ts
'use client';

import { createClientSupabaseClient } from "@/lib/data/supabase/client";
import { useEffect, useState } from "react";
import { Database } from "@/lib/data/supabase/database.types";

type Profile = Database['public']['Tables']['profiles']['Row'];

interface ImpersonationSession {
  id: string;
  admin_id: string;
  impersonated_id: string;
  admin: {
    email: string;
  };
  impersonated: {
    email: string;
    role: string;
  };
}

export function useImpersonation() {
  const [impersonationData, setImpersonationData] = useState<{
    adminEmail: string;
    userEmail: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClientSupabaseClient();

    async function checkImpersonation() {
      // Get the impersonation session ID from cookie
      const sessionId = document.cookie
        .split('; ')
        .find(row => row.startsWith('impersonation_id='))
        ?.split('=')[1];

      if (!sessionId) {
        setImpersonationData(null);
        return;
      }

      const { data: session } = await supabase
        .from('impersonation_sessions')
        .select(`
          id,
          admin_id,
          impersonated_id,
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

      console.log('[useImpersonation] Session data:', session);

      if (session?.admin?.email && session?.impersonated?.email) {
        setImpersonationData({
          adminEmail: session.admin.email,
          userEmail: session.impersonated.email
        });
      } else {
        setImpersonationData(null);
      }
    }

    checkImpersonation();

    const channel = supabase
      .channel('impersonation')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'impersonation_sessions' 
      }, checkImpersonation)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return impersonationData;
} 
```

# hooks/use-media-query.ts

```ts
"use client"

import { useEffect, useState } from "react"

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) {
      setMatches(media.matches)
    }

    const listener = () => setMatches(media.matches)
    media.addEventListener("change", listener)
    
    return () => media.removeEventListener("change", listener)
  }, [matches, query])

  return matches
} 
```

# hooks/use-table-handlers.ts

```ts
"use client"

import { useCallback, useTransition } from "react"
import { toast } from "@/hooks/use-toast"

export function useTableHandlers<TData>() {
  const [isPending, startTransition] = useTransition()

  const handleEdit = useCallback((
    item: TData, 
    editAction?: (data: TData) => Promise<void>
  ) => {
    if (!editAction) return

    startTransition(async () => {
      try {
        await editAction(item)
        toast({
          title: "Success",
          description: "Item updated successfully",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update item",
          variant: "destructive",
        })
      }
    })
  }, [])

  const handleDelete = useCallback((
    item: TData, 
    deleteAction?: (data: TData) => Promise<void>
  ) => {
    if (!deleteAction) return

    startTransition(async () => {
      try {
        await deleteAction(item)
        toast({
          title: "Success",
          description: "Item deleted successfully",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete item",
          variant: "destructive",
        })
      }
    })
  }, [])

  return {
    handleEdit,
    handleDelete,
    isPending
  }
} 
```

# hooks/use-table-state.ts

```ts
"use client"

import { useState, useCallback, useEffect } from "react"
import { SortingState, VisibilityState, ColumnFiltersState } from "@tanstack/react-table"

interface UseTableStateProps {
  storageKey?: string
  initialState?: {
    sorting?: SortingState
    columnVisibility?: VisibilityState
    columnFilters?: ColumnFiltersState
  }
}

export function useTableState({ storageKey, initialState }: UseTableStateProps) {
  // Initialize state from localStorage or initial values
  const [sorting, setSorting] = useState<SortingState>(
    initialState?.sorting || []
  )
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialState?.columnVisibility || {}
  )
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    initialState?.columnFilters || []
  )

  // Load state from localStorage
  useEffect(() => {
    if (!storageKey) return

    const savedState = localStorage.getItem(storageKey)
    if (savedState) {
      const { sorting, columnVisibility, columnFilters } = JSON.parse(savedState)
      if (sorting) setSorting(sorting)
      if (columnVisibility) setColumnVisibility(columnVisibility)
      if (columnFilters) setColumnFilters(columnFilters)
    }
  }, [storageKey])

  // Save state to localStorage
  const saveState = useCallback(() => {
    if (!storageKey) return

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        sorting,
        columnVisibility,
        columnFilters,
      })
    )
  }, [storageKey, sorting, columnVisibility, columnFilters])

  useEffect(() => {
    saveState()
  }, [saveState])

  return {
    sorting,
    setSorting,
    columnVisibility,
    setColumnVisibility,
    columnFilters,
    setColumnFilters,
  }
} 
```

# hooks/use-toast.ts

```ts
"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }

```

# lib/auth/guards.ts

```ts
"use server";

import { createServerSupabaseClient } from "@/lib/data/supabase/server";

type AdminGuardResult = 
  | { success: true; data: { id: string } }
  | { success: false; error: string };

export async function adminGuard(): Promise<AdminGuardResult> {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return { success: false, error: "User not found" };
  }

  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (currentUserRole?.role !== 'admin') {
    return { success: false, error: "Only admins can perform this action" };
  }

  return { success: true, data: { id: user.id } };
} 
```

# lib/auth/middleware/handlers/auth.ts

```ts
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
```

# lib/auth/middleware/handlers/impersonation.ts

```ts
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
```

# lib/auth/middleware/utils/supabase.ts

```ts
import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import { Database } from '../../../data/supabase/database.types'

export function createSupabaseClient(request: NextRequest, response: NextResponse) {
  const cookieStore = new Map<string, string>();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name) ?? request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value);
          response.cookies.set({
            name,
            value,
            ...options,
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
} 
```

# lib/data/supabase/auth.ts

```ts
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { cache } from 'react'

export const getUserRole = cache(async (supabase: SupabaseClient<Database>, userId: string) => {
  console.log('[Auth/Role] Fetching role for user:', { userId });
  
  try {
    const { data: roleData, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('[Auth/Role] Error fetching user role:', {
        error: error.message,
        userId,
        sql: `SELECT role FROM user_roles WHERE id = '${userId}'`
      });
      return null;
    }
    
    console.log('[Auth/Role] Role found:', {
      userId,
      role: roleData?.role
    });
    
    return roleData?.role;
  } catch (error) {
    console.error('[Auth/Role] Unexpected error:', {
      error,
      userId
    });
    return null;
  }
});

// Helper function to check if user has admin role
export async function isAdmin(supabase: SupabaseClient<Database>, userId: string) {
  console.log('[Auth/Admin] Checking admin status:', { userId });
  
  const role = await getUserRole(supabase, userId);
  const isAdminUser = role === 'admin';
  
  console.log('[Auth/Admin] Admin check result:', {
    userId,
    role,
    isAdmin: isAdminUser
  });
  
  return isAdminUser;
} 
```

# lib/data/supabase/check-env-vars.ts

```ts
// This check can be removed
// it is just for tutorial purposes

export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

```

# lib/data/supabase/client.ts

```ts
import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

export const createClientSupabaseClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

```

# lib/data/supabase/database.types.ts

```ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analytics: {
        Row: {
          bounce_rate: number
          created_at: string
          date: string
          id: string
          page_views: number
          source: string
          visitors: number
        }
        Insert: {
          bounce_rate?: number
          created_at?: string
          date?: string
          id?: string
          page_views?: number
          source: string
          visitors?: number
        }
        Update: {
          bounce_rate?: number
          created_at?: string
          date?: string
          id?: string
          page_views?: number
          source?: string
          visitors?: number
        }
        Relationships: []
      }
      impersonation_sessions: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string
          id: string
          impersonated_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at: string
          id?: string
          impersonated_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          impersonated_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_impersonated_id_fkey"
            columns: ["impersonated_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          metadata: Json | null
          raw_user_meta_data: Json | null
          role: Database["public"]["Enums"]["user_role"] | null
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id: string
          metadata?: Json | null
          raw_user_meta_data?: Json | null
          role?: Database["public"]["Enums"]["user_role"] | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          metadata?: Json | null
          raw_user_meta_data?: Json | null
          role?: Database["public"]["Enums"]["user_role"] | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_tenant_id"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          admin_id: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_password_reset_token: {
        Args: {
          user_email: string
        }
        Returns: string
      }
      create_tenant: {
        Args: {
          tenant_name: string
          admin_user_id: string
        }
        Returns: Json
      }
      create_tenant_with_admin: {
        Args: {
          tenant_name: string
          admin_user_id: string
        }
        Returns: Json
      }
      create_user_profile: {
        Args: {
          p_user_id: string
          p_email: string
          p_role: string
          p_tenant_id?: string
          p_created_by?: string
        }
        Returns: undefined
      }
      delete_tenant: {
        Args: {
          tenant_id: string
        }
        Returns: undefined
      }
      get_active_impersonation: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          admin_id: string
          impersonated_id: string
          admin_email: string
          impersonated_email: string
          expires_at: string
        }[]
      }
      verify_user_roles_setup: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
    }
    Enums: {
      user_role: "admin" | "user" | "guest"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

```

# lib/data/supabase/impersonation.ts

```ts
import { createServerSupabaseClient } from "./server";
import { cookies } from "next/headers";
import { Database } from "./database.types";

type ImpersonationSession = Database['public']['Tables']['impersonation_sessions']['Row'] & {
  admin: Pick<Database['public']['Tables']['profiles']['Row'], 'email'>;
  impersonated: Pick<Database['public']['Tables']['profiles']['Row'], 'email'>;
}

export async function startImpersonation(userId: string) {
  const supabase = await createServerSupabaseClient();
  
  // Verify current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Not authenticated');
  }

  // Create impersonation session with a single query
  const { data: session, error: sessionError } = await supabase
    .from('impersonation_sessions')
    .insert({
      admin_id: user.id,
      impersonated_id: userId,
      expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour
    })
    .select(`
      *,
      admin:profiles!impersonation_sessions_admin_id_fkey(email),
      impersonated:profiles!impersonation_sessions_impersonated_id_fkey(email,role)
    `)
    .single();

  if (sessionError || !session?.admin?.email || !session?.impersonated?.email) {
    throw new Error('Failed to create impersonation session');
  }

  // Set cookie with settings that allow client access
  const cookieStore = await cookies();
  cookieStore.set('impersonation_id', session.id, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60,
    path: '/'
  });

  // Dispatch custom event for immediate UI update
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('impersonationStarted', {
      detail: {
        adminEmail: session.admin.email,
        userEmail: session.impersonated.email
      }
    });
    window.dispatchEvent(event);
  }

  return session;
}

export async function stopImpersonation() {
  const supabase = await createServerSupabaseClient();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('impersonation_id')?.value;
  
  if (!sessionId) return;

  await supabase
    .from('impersonation_sessions')
    .delete()
    .eq('id', sessionId);

  cookieStore.delete('impersonation_id');

  // Trigger client-side updates
  if (typeof window !== 'undefined') {
    localStorage.removeItem('impersonation_id');
  }
}

export async function getImpersonatedUser() {
  const supabase = await createServerSupabaseClient();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('impersonation_id')?.value;
  
  if (!sessionId) return null;

  const { data: session } = await supabase
    .from('impersonation_sessions')
    .select(`
      impersonated_user:profiles!impersonation_sessions_impersonated_id_fkey(
        id,
        email,
        role,
        metadata
      )
    `)
    .eq('id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .single();

  return session?.impersonated_user || null;
}

export async function getActiveImpersonation() {
  const supabase = await createServerSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .rpc('get_active_impersonation')
      .maybeSingle();
      
    if (error) {
      console.error('[Impersonation] Failed to get active session:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Impersonation] Error:', error); 
    return null;
  }
} 
```

# lib/data/supabase/routes.ts

```ts
import { UserRole } from './types'

export const ROLE_ROUTES: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '/admin',
  [UserRole.ADMIN]: '/admin',
  [UserRole.USER]: '/protected',
  [UserRole.GUEST]: '/protected'
} as const

export const DEFAULT_REDIRECT = '/protected' 
```

# lib/data/supabase/server.ts

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { Database } from './database.types'
import { UserRole } from './types'
import { User } from '@supabase/supabase-js'
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

// Define proper types for database operations
type UserRoleRow = Database['public']['Tables']['user_roles']['Row']
type UserRoleInsert = Database['public']['Tables']['user_roles']['Insert']
type UserRoleUpdate = Database['public']['Tables']['user_roles']['Update']

// Update type definitions to match database types
type DBUserRole = Database['public']['Enums']['user_role']

export const createServerSupabaseClient = cache(async (useServiceRole: boolean = false) => {
  const cookieStore = await cookies()
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    useServiceRole ? process.env.SUPABASE_SERVICE_ROLE_KEY! : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Convert CookieOptions to ResponseCookie format
            const { sameSite, ...rest } = options
            cookieStore.set({
              name,
              value,
              ...rest,
              sameSite: sameSite as ResponseCookie['sameSite']
            })
          } catch (error) {
            console.error('Cookie set error:', error)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // Convert CookieOptions to ResponseCookie format
            const { sameSite, ...rest } = options
            cookieStore.delete({
              name,
              ...rest,
              sameSite: sameSite as ResponseCookie['sameSite']
            })
          } catch (error) {
            console.error('Cookie remove error:', error)
          }
        },
      },
    }
  )
})

export const getServerUser = cache(async () => {
  const supabase = await createServerSupabaseClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (roleError) {
      console.error('Error fetching user role:', roleError)
      return { ...user, role: 'guest' as const }
    }

    return { ...user, role: (roleData?.role || 'guest') as UserRole }
  } catch (error) {
    console.error('Error getting server user:', error)
    return null
  }
})

export const getUserRole = cache(async (userId: string): Promise<UserRole> => {
  if (!userId) return UserRole.GUEST
  
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) throw error
    return (data?.role as UserRole) || UserRole.GUEST
  } catch (error) {
    console.error('Error fetching user role:', error)
    return UserRole.GUEST
  }
})

export const ensureUserRole = async (
  userId: string, 
  role: DBUserRole = 'user' // Use string literal type instead of enum
) => {
  const supabase = await createServerSupabaseClient()
  
  const { data: existingRole, error: fetchError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userId)
    .single()

  console.log('[Auth] Checking user role:', {
    userId,
    existingRole,
    fetchError
  })

  if (!existingRole) {
    const insertData: UserRoleInsert = {
      id: userId,
      role: role as DBUserRole, // Cast to database enum type
      updated_at: new Date().toISOString()
    }

    const { error: insertError } = await supabase
      .from('user_roles')
      .insert([insertData])
      .single()

    console.log('[Auth] Created new user role:', {
      userId,
      role,
      error: insertError
    })

    if (insertError) {
      console.error('[Auth] Failed to create user role:', insertError)
    }
  } else if (existingRole.role !== role) {
    const updateData: UserRoleUpdate = {
      role: role as DBUserRole, // Cast to database enum type
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('user_roles')
      .update(updateData)
      .eq('id', userId)

    console.log('[Auth] Updated user role:', {
      userId,
      oldRole: existingRole.role,
      newRole: role,
      error: updateError
    })
  }
} 
```

# lib/data/supabase/types.ts

```ts
import { Database } from './database.types'

export type Tables = Database['public']['Tables']
export type DBUserRole = Database['public']['Enums']['user_role']

// Update enum to match database types
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest'
}

// Helper function to convert between enum and database type
export const toDBRole = (role: UserRole): DBUserRole => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return 'admin' // Map super_admin to admin in database
    default:
      return role.toLowerCase() as DBUserRole
  }
}

// Type for the user_roles table
export type UserRoleData = Tables['user_roles']['Row']

// Type for the profiles table
export type Profile = Tables['profiles']['Row']

// Type for impersonation sessions
export type ImpersonationSession = Tables['impersonation_sessions']['Row']

// Helper type for Supabase row data with nested auth.users
export interface UserRoleWithAuth {
  id: string;
  email: string;
  role: Database['public']['Enums']['user_role'];
  updated_at: string;
  metadata: {
    tenant_name?: string;
    [key: string]: any;
  } | null;
  raw_user_meta_data: Database['public']['Tables']['profiles']['Row']['raw_user_meta_data'];
  tenants?: {
    id: string;
    name: string;
  } | null;
  tenant_id?: string | null;
}

// Type for the response from get_active_impersonation RPC
export type ActiveImpersonation = Database['public']['Functions']['get_active_impersonation']['Returns']

// Type for database functions
export type DatabaseFunctions = {
  get_active_impersonation: () => Promise<ActiveImpersonation>;
  verify_user_roles_setup: () => Promise<Database['public']['Functions']['verify_user_roles_setup']['Returns']>;
  create_password_reset_token: (args: { user_email: string }) => Promise<string>;
} 
```

# lib/utils.ts

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null): string {
  if (!date) return 'N/A';
  
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

```

# lib/validations/data-table.ts

```ts
import { z } from "zod"

export const tableActionSchema = z.object({
  id: z.string(),
  action: z.enum(["edit", "delete", "view"]),
  data: z.record(z.unknown())
})

export async function validateTableAction(data: unknown) {
  return tableActionSchema.parseAsync(data)
} 
```

# middleware.ts

```ts
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

```

# next-env.d.ts

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.

```

# next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;

```

# package.json

```json
{
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "update-types": "supabase gen types typescript --linked > lib/data/supabase/database.types.ts"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.1",
    "@radix-ui/react-alert-dialog": "^1.1.2",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-checkbox": "^1.1.1",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.1",
    "@radix-ui/react-icons": "^1.3.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-scroll-area": "^1.2.1",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.2",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "latest",
    "@tanstack/react-table": "^8.20.5",
    "autoprefixer": "10.4.20",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "cookies-next": "^5.0.2",
    "geist": "^1.2.1",
    "lucide-react": "^0.456.0",
    "next": "latest",
    "next-themes": "^0.4.3",
    "prettier": "^3.3.3",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-hook-form": "^7.53.2",
    "react-icons": "^5.3.0",
    "resend": "^4.0.1",
    "use-debounce": "^10.0.4",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "18.3.1",
    "postcss": "8.4.49",
    "tailwind-merge": "^2.5.2",
    "tailwindcss": "3.4.14",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "5.6.3"
  }
}

```

# postcss.config.js

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

# project-structure.txt

```txt
.
├── actions
│   ├── admin.ts
│   ├── auth.ts
│   ├── subscription.ts
│   ├── tenant
│   │   ├── create.ts
│   │   └── delete.ts
│   ├── user
│   │   ├── create.ts
│   │   └── delete.ts
│   ├── user.ts
│   └── utils.ts
├── app
│   ├── admin
│   │   ├── dashboard
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   ├── tenants
│   │   │   └── page.tsx
│   │   └── users
│   │       └── page.tsx
│   ├── auth
│   │   ├── callback
│   │   │   └── route.ts
│   │   ├── forgot-password
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   ├── reset-password
│   │   │   └── page.tsx
│   │   ├── sign-in
│   │   │   └── page.tsx
│   │   └── sign-up
│   │       └── page.tsx
│   ├── dashboard
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── error.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   ├── loading.tsx
│   ├── page.tsx
│   └── public
│       ├── favicon.png
│       └── logo.svg
├── components
│   ├── admin
│   │   ├── sidebar.tsx
│   │   ├── tenant
│   │   │   ├── create-tenant-dialog.tsx
│   │   │   └── tenants-table.tsx
│   │   └── user
│   │       ├── create-user-dialog.tsx
│   │       └── users-table.tsx
│   ├── common
│   │   ├── auth-card.tsx
│   │   └── smtp-message.tsx
│   ├── form-message.tsx
│   ├── header-auth.tsx
│   ├── hoc
│   │   └── with-admin-protection.tsx
│   ├── impersonation-banner.tsx
│   ├── layouts
│   │   ├── data-table-page.tsx
│   │   └── impersonation-wrapper.tsx
│   ├── logo.tsx
│   ├── site-header.tsx
│   ├── submit-button.tsx
│   ├── subscribe-form.tsx
│   ├── theme-switcher.tsx
│   └── ui
│       ├── alert-dialog.tsx
│       ├── alert.tsx
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── data-table
│       │   ├── data-table-column-header.tsx
│       │   ├── data-table-empty.tsx
│       │   ├── data-table-error.tsx
│       │   ├── data-table-header.tsx
│       │   ├── data-table-pagination.tsx
│       │   ├── data-table-toolbar.tsx
│       │   ├── data-table-view-options.tsx
│       │   ├── data-table.tsx
│       │   └── table-skeleton.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── form.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── sheet.tsx
│       ├── skeleton.tsx
│       ├── table.tsx
│       ├── toast.tsx
│       └── toaster.tsx
├── components.json
├── hooks
│   ├── use-impersonation.ts
│   ├── use-media-query.ts
│   ├── use-table-handlers.ts
│   ├── use-table-state.ts
│   └── use-toast.ts
├── lib
│   ├── auth
│   │   ├── guards.ts
│   │   └── middleware
│   │       ├── handlers
│   │       │   ├── auth.ts
│   │       │   └── impersonation.ts
│   │       └── utils
│   │           └── supabase.ts
│   ├── data
│   │   └── supabase
│   │       ├── auth.ts
│   │       ├── check-env-vars.ts
│   │       ├── client.ts
│   │       ├── database.types.ts
│   │       ├── impersonation.ts
│   │       ├── routes.ts
│   │       ├── server.ts
│   │       └── types.ts
│   ├── utils.ts
│   └── validations
│       └── data-table.ts
├── middleware.ts
├── next-env.d.ts
├── next.config.js
├── package-lock.json
├── package.json
├── postcss.config.js
├── project-structure.txt
├── supabase
│   ├── config.toml
│   └── migrations
│       ├── 20241124045214_remote_schema.sql
│       ├── add_auth_policies.sql
│       ├── add_impersonation.sql
│       ├── add_policies.sql
│       ├── add_tenant_admin_trigger.sql
│       ├── check_constraints.sql
│       ├── create_profiles.sql
│       ├── fix_get_active_impersonation.sql
│       ├── fix_policies.sql
│       ├── update_admin_policies.sql
│       ├── update_profiles.sql
│       ├── update_profiles_metadata.sql
│       ├── verify_policies.sql
│       ├── verify_schema.sql
│       └── verify_setup.sql
├── tailwind.config.ts
├── tsconfig.json
├── types
│   └── data-table.ts
└── utils
    ├── cn.ts
    └── utils.ts

39 directories, 123 files

```

# supabase/.gitignore

```
# Supabase
.branches
.temp
.env

```

# supabase/.temp/cli-latest

```
v1.223.10
```

# supabase/.temp/gotrue-version

```
v2.164.0
```

# supabase/.temp/pooler-url

```
postgresql://postgres.wubqscctyndwzxmylaia:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

# supabase/.temp/postgres-version

```
15.6.1.141
```

# supabase/.temp/project-ref

```
wubqscctyndwzxmylaia
```

# supabase/.temp/rest-version

```
v12.2.3
```

# supabase/.temp/storage-version

```
v1.13.0
```

# supabase/config.toml

```toml
# A string used to distinguish different Supabase projects on the same host. Defaults to the
# working directory name when running `supabase init`.
project_id = "template-church-app"

[api]
enabled = true
# Port to use for the API URL.
port = 54321
# Schemas to expose in your API. Tables, views and stored procedures in this schema will get API
# endpoints. `public` is always included.
schemas = ["public", "graphql_public"]
# Extra schemas to add to the search_path of every request. `public` is always included.
extra_search_path = ["public", "extensions"]
# The maximum number of rows returns from a view, table, or stored procedure. Limits payload size
# for accidental or malicious requests.
max_rows = 1000

[api.tls]
enabled = false

[db]
# Port to use for the local database URL.
port = 54322
# Port used by db diff command to initialize the shadow database.
shadow_port = 54320
# The database major version to use. This has to be the same as your remote database's. Run `SHOW
# server_version;` on the remote database to check.
major_version = 15

[db.pooler]
enabled = false
# Port to use for the local connection pooler.
port = 54329
# Specifies when a server connection can be reused by other clients.
# Configure one of the supported pooler modes: `transaction`, `session`.
pool_mode = "transaction"
# How many server connections to allow per user/database pair.
default_pool_size = 20
# Maximum number of client connections allowed.
max_client_conn = 100

[db.seed]
# If enabled, seeds the database after migrations during a db reset.
enabled = true
# Specifies an ordered list of seed files to load during db reset.
# Supports glob patterns relative to supabase directory. For example:
# sql_paths = ['./seeds/*.sql', '../project-src/seeds/*-load-testing.sql']
sql_paths = ['./seed.sql']

[realtime]
enabled = true
# Bind realtime via either IPv4 or IPv6. (default: IPv4)
# ip_version = "IPv6"
# The maximum length in bytes of HTTP request headers. (default: 4096)
# max_header_length = 4096

[studio]
enabled = true
# Port to use for Supabase Studio.
port = 54323
# External URL of the API server that frontend connects to.
api_url = "http://127.0.0.1"
# OpenAI API Key to use for Supabase AI in the Supabase Studio.
openai_api_key = "env(OPENAI_API_KEY)"

# Email testing server. Emails sent with the local dev setup are not actually sent - rather, they
# are monitored, and you can view the emails that would have been sent from the web interface.
[inbucket]
enabled = true
# Port to use for the email testing server web interface.
port = 54324
# Uncomment to expose additional ports for testing user applications that send emails.
# smtp_port = 54325
# pop3_port = 54326

[storage]
enabled = true
# The maximum file size allowed (e.g. "5MB", "500KB").
file_size_limit = "50MiB"

[storage.image_transformation]
enabled = true

# Uncomment to configure local storage buckets
# [storage.buckets.images]
# public = false
# file_size_limit = "50MiB"
# allowed_mime_types = ["image/png", "image/jpeg"]
# objects_path = "./images"

[auth]
enabled = true
# The base URL of your website. Used as an allow-list for redirects and for constructing URLs used
# in emails.
site_url = "http://127.0.0.1:3000"
# A list of *exact* URLs that auth providers are permitted to redirect to post authentication.
additional_redirect_urls = ["https://127.0.0.1:3000"]
# How long tokens are valid for, in seconds. Defaults to 3600 (1 hour), maximum 604,800 (1 week).
jwt_expiry = 3600
# If disabled, the refresh token will never expire.
enable_refresh_token_rotation = true
# Allows refresh tokens to be reused after expiry, up to the specified interval in seconds.
# Requires enable_refresh_token_rotation = true.
refresh_token_reuse_interval = 10
# Allow/disallow new user signups to your project.
enable_signup = true
# Allow/disallow anonymous sign-ins to your project.
enable_anonymous_sign_ins = false
# Allow/disallow testing manual linking of accounts
enable_manual_linking = false

[auth.email]
# Allow/disallow new user signups via email to your project.
enable_signup = true
# If enabled, a user will be required to confirm any email change on both the old, and new email
# addresses. If disabled, only the new email is required to confirm.
double_confirm_changes = true
# If enabled, users need to confirm their email address before signing in.
enable_confirmations = false
# If enabled, users will need to reauthenticate or have logged in recently to change their password.
secure_password_change = false
# Controls the minimum amount of time that must pass before sending another signup confirmation or password reset email.
max_frequency = "1s"
# Number of characters used in the email OTP.
otp_length = 6
# Number of seconds before the email OTP expires (defaults to 1 hour).
otp_expiry = 3600

# Use a production-ready SMTP server
# [auth.email.smtp]
# host = "smtp.sendgrid.net"
# port = 587
# user = "apikey"
# pass = "env(SENDGRID_API_KEY)"
# admin_email = "admin@email.com"
# sender_name = "Admin"

# Uncomment to customize email template
# [auth.email.template.invite]
# subject = "You have been invited"
# content_path = "./supabase/templates/invite.html"

[auth.sms]
# Allow/disallow new user signups via SMS to your project.
enable_signup = false
# If enabled, users need to confirm their phone number before signing in.
enable_confirmations = false
# Template for sending OTP to users
template = "Your code is {{ .Code }} ."
# Controls the minimum amount of time that must pass before sending another sms otp.
max_frequency = "5s"

# Use pre-defined map of phone number to OTP for testing.
# [auth.sms.test_otp]
# 4152127777 = "123456"

# Configure logged in session timeouts.
# [auth.sessions]
# Force log out after the specified duration.
# timebox = "24h"
# Force log out if the user has been inactive longer than the specified duration.
# inactivity_timeout = "8h"

# This hook runs before a token is issued and allows you to add additional claims based on the authentication method used.
# [auth.hook.custom_access_token]
# enabled = true
# uri = "pg-functions://<database>/<schema>/<hook_name>"

# Configure one of the supported SMS providers: `twilio`, `twilio_verify`, `messagebird`, `textlocal`, `vonage`.
[auth.sms.twilio]
enabled = false
account_sid = ""
message_service_sid = ""
# DO NOT commit your Twilio auth token to git. Use environment variable substitution instead:
auth_token = "env(SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN)"

[auth.mfa]
# Control how many MFA factors can be enrolled at once per user.
max_enrolled_factors = 10

# Control use of MFA via App Authenticator (TOTP)
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true

# Configure Multi-factor-authentication via Phone Messaging
[auth.mfa.phone]
enroll_enabled = false
verify_enabled = false
otp_length = 6
template = "Your code is {{ .Code }}"
max_frequency = "5s"

# Configure Multi-factor-authentication via WebAuthn
# [auth.mfa.web_authn]
# enroll_enabled = true
# verify_enabled = true

# Use an external OAuth provider. The full list of providers are: `apple`, `azure`, `bitbucket`,
# `discord`, `facebook`, `github`, `gitlab`, `google`, `keycloak`, `linkedin_oidc`, `notion`, `twitch`,
# `twitter`, `slack`, `spotify`, `workos`, `zoom`.
[auth.external.apple]
enabled = false
client_id = ""
# DO NOT commit your OAuth provider secret to git. Use environment variable substitution instead:
secret = "env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)"
# Overrides the default auth redirectUrl.
redirect_uri = ""
# Overrides the default auth provider URL. Used to support self-hosted gitlab, single-tenant Azure,
# or any other third-party OIDC providers.
url = ""
# If enabled, the nonce check will be skipped. Required for local sign in with Google auth.
skip_nonce_check = false

# Use Firebase Auth as a third-party provider alongside Supabase Auth.
[auth.third_party.firebase]
enabled = false
# project_id = "my-firebase-project"

# Use Auth0 as a third-party provider alongside Supabase Auth.
[auth.third_party.auth0]
enabled = false
# tenant = "my-auth0-tenant"
# tenant_region = "us"

# Use AWS Cognito (Amplify) as a third-party provider alongside Supabase Auth.
[auth.third_party.aws_cognito]
enabled = false
# user_pool_id = "my-user-pool-id"
# user_pool_region = "us-east-1"

[edge_runtime]
enabled = true
# Configure one of the supported request policies: `oneshot`, `per_worker`.
# Use `oneshot` for hot reload, or `per_worker` for load testing.
policy = "oneshot"
inspector_port = 8083

[analytics]
enabled = true
port = 54327
# Configure one of the supported backends: `postgres`, `bigquery`.
backend = "postgres"

# Experimental features may be deprecated any time
[experimental]
# Configures Postgres storage engine to use OrioleDB (S3)
orioledb_version = ""
# Configures S3 bucket URL, eg. <bucket_name>.s3-<region>.amazonaws.com
s3_host = "env(S3_HOST)"
# Configures S3 bucket region, eg. us-east-1
s3_region = "env(S3_REGION)"
# Configures AWS_ACCESS_KEY_ID for S3 bucket
s3_access_key = "env(S3_ACCESS_KEY)"
# Configures AWS_SECRET_ACCESS_KEY for S3 bucket
s3_secret_key = "env(S3_SECRET_KEY)"

```

# tailwind.config.ts

```ts
import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;

```

# tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

```

# types/data-table.ts

```ts
import { ColumnDef, Table, SortingState, VisibilityState, ColumnFiltersState } from "@tanstack/react-table"
import { z } from "zod"

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  
  // Search and filtering
  searchKey?: string
  searchPlaceholder?: string
  filterableColumns?: {
    id: string
    title: string
    options: {
      label: string
      value: string
    }[]
  }[]

  // Pagination
  pageSize?: number
  pageSizeOptions?: number[]
  
  // Actions and modals
  deleteAction?: (data: TData) => Promise<void>
  editAction?: (data: TData) => Promise<void>
  viewAction?: (data: TData) => void
  createAction?: () => void
  
  // Modal customization
  deleteModalTitle?: string
  deleteModalDescription?: string
  editModalTitle?: string
  
  // Table state persistence
  storageKey?: string
  initialState?: {
    sorting?: SortingState
    columnVisibility?: VisibilityState
    columnFilters?: ColumnFiltersState
  }
  
  // Row selection
  enableRowSelection?: boolean
  onRowSelectionChange?: (selectedRows: TData[]) => void
  
  // Custom components
  renderCustomActions?: (data: TData) => React.ReactNode
  headerActions?: React.ReactNode
  emptyState?: React.ReactNode
  loadingState?: React.ReactNode
}

export interface DataTableToolbarProps<TData> {
  table: Table<TData>
  searchKey?: string
  searchPlaceholder?: string
  filterableColumns?: DataTableProps<TData, any>["filterableColumns"]
  headerActions?: React.ReactNode
  createAction?: () => void
}

export interface DataTablePaginationProps<TData> {
  table: Table<TData>
  pageSizeOptions?: number[]
}

// Add validation schemas
export const DataTableActionSchema = z.object({
  id: z.string(),
  action: z.enum(["edit", "delete", "view"])
})

export type DataTableAction = z.infer<typeof DataTableActionSchema> 
```

# utils/cn.ts

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

# utils/utils.ts

```ts
import { redirect } from "next/navigation";

/**
 * Redirects to a specified path with an encoded message as a query parameter.
 * @param {('error' | 'success')} type - The type of message, either 'error' or 'success'.
 * @param {string} path - The path to redirect to.
 * @param {string} message - The message to be encoded and added as a query parameter.
 * @returns {never} This function doesn't return as it triggers a redirect.
 */
export function encodedRedirect(
  type: "error" | "success",
  path: string,
  message: string,
) {
  return redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

```

