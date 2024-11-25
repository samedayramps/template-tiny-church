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