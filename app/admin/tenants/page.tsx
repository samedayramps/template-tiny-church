"use client";

import { withAdminProtection } from "@/components/hoc/with-admin-protection";
import { createClientSupabaseClient } from "@/lib/data/supabase/client";
import { useEffect, useState } from "react";
import { useSearchParams } from 'next/navigation';
import { Database } from "@/lib/data/supabase/database.types";
import { useToast } from "@/hooks/use-toast";
import { CreateTenantDialog } from "@/components/admin/tenant/create-tenant-dialog";
import { DataTablePage } from "@/components/layouts/data-table-page";
import { createTenantColumns } from "@/components/admin/tenant/tenants-table";
import { deleteTenant } from "@/actions/tenant/delete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Define types for the data structure returned from Supabase
type TenantWithProfile = {
  id: string;
  name: string;
  domain: string;
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
  tenant_domain: string;
  tenant_created_at: string;
  tenant_updated_at: string;
  admin_id: string;
  admin_email: string;
  admin_role: string;
  user_count: number;
}

function TenantsPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [tenantToDelete, setTenantToDelete] = useState<TenantWithAdmin | null>(null);
  
  // Handle URL params and show toasts
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success) {
      toast({
        title: "Success",
        description: success,
      });
    }
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  const fetchTenants = async (): Promise<TenantWithAdmin[]> => {
    const supabase = createClientSupabaseClient();
    
    try {
      // Fetch tenants with admin info
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

      // Get user count for each tenant
      const tenantsWithCounts = await Promise.all(
        (tenantsData as TenantWithProfile[]).map(async (tenant) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);

          return {
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            tenant_domain: tenant.domain,
            tenant_created_at: tenant.created_at || new Date().toISOString(),
            tenant_updated_at: tenant.updated_at || new Date().toISOString(),
            admin_id: tenant.admin_id,
            admin_email: tenant.profiles?.email || 'No admin email',
            admin_role: tenant.profiles?.role || 'user',
            user_count: count || 0
          } satisfies TenantWithAdmin;
        })
      );

      return tenantsWithCounts;
    } catch (error) {
      console.error('Error fetching tenants:', error);
      throw error;
    }
  };

  const handleDelete = async (tenant: TenantWithAdmin) => {
    setTenantToDelete(tenant);
  };

  const confirmDelete = async () => {
    if (!tenantToDelete) return;
    
    try {
      const result = await deleteTenant(tenantToDelete.tenant_id);
      // Let Next.js handle the redirect
      throw result;
    } catch (error) {
      if (error && 
          typeof error === 'object' && 
          'digest' in error && 
          typeof (error as { digest: string }).digest === 'string' && 
          (error as { digest: string }).digest.includes('success')) {
        // This is a success redirect, let Next.js handle it
        throw error;
      }
      
      toast({
        title: "Error",
        description: "Failed to delete tenant",
        variant: "destructive",
      });
    } finally {
      setTenantToDelete(null);
    }
  };

  return (
    <>
      <DataTablePage<TenantWithAdmin, any>
        title="Manage Tenants"
        description="Create and manage tenant organizations."
        columns={createTenantColumns(
          (tenant) => console.log("Edit tenant:", tenant),
          handleDelete
        )}
        data={[]}
        fetchData={fetchTenants}
        searchKey="tenant_name"
        searchPlaceholder="Filter tenants..."
        headerMetrics={
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              Total tenants: {0}
            </p>
            <CreateTenantDialog />
          </div>
        }
        storageKey="tenants-table-state"
      />

      <AlertDialog 
        open={!!tenantToDelete} 
        onOpenChange={(open) => !open && setTenantToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {tenantToDelete?.tenant_name}? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default withAdminProtection(TenantsPage);
