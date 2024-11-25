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