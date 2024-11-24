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