"use client";

import { withAdminProtection } from "@/components/hoc/with-admin-protection";
import { createClientSupabaseClient } from "@/lib/data/supabase/client";
import { UserRoleWithAuth } from '@/lib/data/supabase/types'
import { createUserColumns } from "@/components/admin/user/users-table"
import { CreateUserDialog } from "@/components/admin/user/create-user-dialog";
import { deleteUser } from "@/actions/user/delete";
import { DataTablePage } from "@/components/ui/data-table/data-table-page";
import { Database } from "@/lib/data/supabase/database.types";
import { useState, useMemo } from "react";
import { EditUserForm } from "@/components/admin/user/edit-user-form"

type ProfileWithTenant = Database['public']['Tables']['profiles']['Row'] & {
  tenants: Database['public']['Tables']['tenants']['Row'] | null;
};

function UsersPage() {
  const [totalUsers, setTotalUsers] = useState(0)
  
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

    // Update total users count
    setTotalUsers(usersData.length)

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

  const columns = useMemo(() => createUserColumns(), [])

  return (
    <DataTablePage<UserRoleWithAuth, any>
      variant="full-page"
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
            Total users: {totalUsers}
          </p>
          <CreateUserDialog />
        </div>
      }
      storageKey="users-table-state"
      deleteAction={async (user) => deleteUser(user.id)}
      getItemDisplayName={(user) => user.email}
      deleteModalTitle="Delete User"
      deleteModalDescription={(email) => 
        `Are you sure you want to delete ${email}? This action cannot be undone.`
      }
      editAction={async (user) => {
        // The form will handle the edit logic
      }}
      editModalTitle="Edit User"
      editModalContent={(user) => (
        <EditUserForm 
          user={{
            id: user.id,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id || undefined
          }} 
          onSuccess={() => {
            fetchUsers()
          }} 
        />
      )}
    />
  );
}

export default withAdminProtection(UsersPage); 