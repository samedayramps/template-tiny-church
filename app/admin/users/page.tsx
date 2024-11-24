"use client";

import { withAdminProtection } from "@/components/hoc/with-admin-protection";
import { ImpersonationWrapper } from "@/components/layouts/impersonation-wrapper";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { UserRoleWithAuth } from '@/lib/supabase/types'
import { UsersDataTable } from "@/components/admin/users-table";
import { useEffect, useState } from "react";

interface UsersPageProps {
  // Add any props you need here
}

function UsersPage(props: UsersPageProps) {
  const [users, setUsers] = useState<UserRoleWithAuth[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [impersonation, setImpersonation] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClientSupabaseClient();
      
      try {
        // Get current user and impersonation status
        const [userResponse, impersonationResponse, usersResponse] = await Promise.all([
          supabase.auth.getUser(),
          supabase.rpc('get_active_impersonation').single(),
          supabase.from('profiles').select(`
            id,
            email,
            role,
            updated_at,
            metadata,
            raw_user_meta_data
          `)
        ]);

        const { data: { user } } = userResponse;
        const { data: impersonationData } = impersonationResponse;
        const { data: usersData, error } = usersResponse as {
          data: UserRoleWithAuth[] | null;
          error: any;
        };

        if (error) {
          console.error('Error fetching users:', error);
        } else {
          setUsers(usersData || []);
          setCurrentUser(user);
          setImpersonation(impersonationData);
        }
      } catch (error) {
        console.error('Error in data fetching:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      {impersonation && (
        <div className="bg-yellow-100 dark:bg-yellow-900 p-2">
          Currently impersonating user: {users.find(u => u.id === impersonation.impersonated_id)?.email}
        </div>
      )}
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Manage Users</h1>
          <p className="text-sm text-muted-foreground">
            Total users: {users?.length || 0}
          </p>
        </div>
        
        <UsersDataTable data={users || []} />
      </div>
    </>
  );
}

// Wrap the page with admin protection
export default withAdminProtection(function AdminUsersPage(props: UsersPageProps) {
  return (
    <ImpersonationWrapper>
      <UsersPage {...props} />
    </ImpersonationWrapper>
  );
}); 