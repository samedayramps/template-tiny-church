"use client";

import { withAdminProtection } from "@/components/hoc/with-admin-protection";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { UserRoleWithAuth } from '@/lib/supabase/types'
import { UsersDataTable } from "@/components/admin/users-table";
import { useEffect, useState } from "react";
import { Database } from "@/lib/supabase/database.types";

type ProfileWithTenant = Database['public']['Tables']['profiles']['Row'] & {
  tenants: Database['public']['Tables']['tenants']['Row'] | null;
};

function UsersPage() {
  const [users, setUsers] = useState<UserRoleWithAuth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      console.group('🔍 UsersPage Data Fetching');
      console.log('Starting data fetch...');
      
      const supabase = createClientSupabaseClient();
      
      try {
        console.log('Executing Supabase queries...');
        
        const [userResponse, usersResponse] = await Promise.all([
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

        const { data: { user } } = userResponse;
        const { data: usersData, error: usersError } = usersResponse;

        if (usersError) throw usersError;
        if (!usersData || !isMounted) return;

        const usersWithTenants = (usersData as ProfileWithTenant[]).map(user => ({
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

        if (isMounted) {
          setUsers(usersWithTenants);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Error in data fetching:', error);
        if (isMounted) {
          setLoading(false);
        }
      } finally {
        console.groupEnd();
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <p className="text-sm text-muted-foreground">
          Total users: {users.length}
        </p>
      </div>
      
      <UsersDataTable data={users} />
    </div>
  );
}

export default withAdminProtection(UsersPage); 