"use client";

import { withAdminProtection } from "@/components/hoc/with-admin-protection";
import { ImpersonationWrapper } from "@/components/layouts/impersonation-wrapper";
import { createClientSupabaseClient } from "@/lib/data/supabase/client";
import { TenantsDataTable } from "@/components/admin/tenants-table";
import { useEffect, useState } from "react";
import { Database } from "@/lib/data/supabase/database.types";
import { useSearchParams } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { CreateTenantDialog } from "@/components/admin/create-tenant-dialog";

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
