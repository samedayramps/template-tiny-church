"use client";

import { withAdminProtection } from "@/components/hoc/with-admin-protection";
import { createClientSupabaseClient } from "@/lib/data/supabase/client";
import { UserRoleWithAuth } from '@/lib/data/supabase/types'
import { createUserColumns } from "@/components/admin/user/users-table"
import { DataTablePage } from "@/components/layouts/data-table-page";
import { Database } from "@/lib/data/supabase/database.types";
import { CreateUserDialog } from "@/components/admin/user/create-user-dialog";
import { useSearchParams } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { deleteUser } from "@/actions/user/delete";
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

type ProfileWithTenant = Database['public']['Tables']['profiles']['Row'] & {
  tenants: Database['public']['Tables']['tenants']['Row'] | null;
};

function UsersPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [userToDelete, setUserToDelete] = useState<UserRoleWithAuth | null>(null);
  
  // Handle URL parameters for success/error messages
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success) {
      toast({
        title: "Success",
        description: decodeURIComponent(success),
        variant: "default",
      });
    }
    
    if (error) {
      toast({
        title: "Error",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

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

  const handleDelete = async (user: UserRoleWithAuth) => {
    setUserToDelete(user);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      const result = await deleteUser(userToDelete.id);
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
        description: "Failed to delete user",
        variant: "destructive",
      });
      throw error;
    } finally {
      setUserToDelete(null);
    }
  };

  const columns = createUserColumns(
    (user) => console.log('Edit', user),
    handleDelete
  );

  return (
    <>
      <DataTablePage<UserRoleWithAuth, any>
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
              Total users: {0}
            </p>
            <CreateUserDialog />
          </div>
        }
        storageKey="users-table-state"
      />

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.email}? This action cannot be undone.
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

export default withAdminProtection(UsersPage); 