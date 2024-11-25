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