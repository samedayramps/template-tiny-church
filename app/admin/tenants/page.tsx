"use client";

import { withAdminProtection } from "@/components/hoc/with-admin-protection";
import { createClientSupabaseClient } from "@/lib/data/supabase/client";
import { CreateTenantDialog } from "@/components/admin/tenant/create-tenant-dialog";
import { createTenantColumns } from "@/components/admin/tenant/tenants-table";
import { deleteTenant } from "@/actions/tenant/delete";
import { DataTablePage } from "@/components/ui/data-table/data-table-page";
import { Database } from "@/lib/data/supabase/database.types";
import { useState, useMemo } from "react";
import { EditTenantForm } from "@/components/admin/tenant/edit-tenant-form"

interface TenantData {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_domain: string;
  tenant_created_at: string;
  tenant_updated_at: string;
  admin_id: string;
  admin_email: string;
  admin_role: string;
  user_count: number;
}

function TenantsPage() {
  const [totalTenants, setTotalTenants] = useState(0)

  const fetchTenants = async (): Promise<TenantData[]> => {
    const supabase = createClientSupabaseClient();
    
    try {
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select(`
          id,
          name,
          domain,
          created_at,
          updated_at,
          admin_id,
          profiles!tenants_admin_id_fkey (
            email,
            role
          )
        `);

      if (tenantsError) throw tenantsError;
      if (!tenantsData) return [];

      // Update total tenants count
      setTotalTenants(tenantsData.length)

      return tenantsData.map((tenant: any) => ({
        id: tenant.id,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_domain: tenant.domain,
        tenant_created_at: tenant.created_at,
        tenant_updated_at: tenant.updated_at,
        admin_id: tenant.admin_id,
        admin_email: tenant.profiles?.email || 'No Admin',
        admin_role: tenant.profiles?.role || 'none',
        user_count: 0
      }));
    } catch (error) {
      console.error('Error fetching tenants:', error);
      throw error;
    }
  };

  const columns = useMemo(() => createTenantColumns(), [])

  return (
    <DataTablePage<TenantData, any>
      variant="full-page"
      title="Manage Tenants"
      description="Create and manage tenant organizations"
      columns={columns}
      data={[]}
      fetchData={fetchTenants}
      searchKey="tenant_name"
      searchPlaceholder="Filter tenants..."
      headerMetrics={
        <p className="text-sm text-muted-foreground">
          Total tenants: {totalTenants}
        </p>
      }
      createAction={() => {
        // Handle create action
      }}
      storageKey="tenants-table-state"
      deleteAction={async (tenant) => deleteTenant(tenant.tenant_id)}
      getItemDisplayName={(tenant) => tenant.tenant_name}
      deleteModalTitle="Delete Tenant"
      deleteModalDescription={(name) => 
        `Are you sure you want to delete ${name}? This action cannot be undone and will remove all associated data.`
      }
      editAction={async (tenant) => {
        // The form will handle the edit logic
      }}
      editModalTitle="Edit Tenant"
      editModalContent={(tenant) => (
        <EditTenantForm 
          tenant={{
            id: tenant.id,
            tenant_name: tenant.tenant_name,
            tenant_domain: tenant.tenant_domain,
            admin_email: tenant.admin_email
          }} 
          onSuccess={() => {
            fetchTenants()
          }} 
        />
      )}
    />
  );
}

export default withAdminProtection(TenantsPage);
