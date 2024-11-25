"use client";

import { withAdminProtection } from "@/components/hoc/with-admin-protection";
import { createClientSupabaseClient } from "@/lib/data/supabase/client";
import { UserRoleWithAuth } from '@/lib/data/supabase/types'
import { createUserColumns } from "@/components/admin/users-table"
import { DataTablePage } from "@/components/layouts/data-table-page";
import { Database } from "@/lib/data/supabase/database.types";

type ProfileWithTenant = Database['public']['Tables']['profiles']['Row'] & {
  tenants: Database['public']['Tables']['tenants']['Row'] | null;
};

function UsersPage() {
  const fetchUsers = async () => {
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

  const columns = createUserColumns(
    (user) => console.log('Edit', user),
    (user) => console.log('Delete', user)
  );

  return (
    <DataTablePage<UserRoleWithAuth, any>
      title="Manage Users"
      description="View and manage user accounts across all tenants."
      columns={columns}
      data={[]}
      fetchData={fetchUsers}
      searchKey="email"
      searchPlaceholder="Filter users..."
      headerMetrics={
        <p className="text-sm text-muted-foreground">
          Total users: {0}
        </p>
      }
      storageKey="users-table-state"
    />
  );
}

export default withAdminProtection(UsersPage); 