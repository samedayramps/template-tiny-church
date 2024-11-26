import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { adminGuard } from "@/lib/auth/guards";
import { DeleteTenantButton } from "@/components/admin/tenant/delete-tenant-button";

// Types for params
type PageProps = {
  params: Promise<{ id: string }>;
};

// Simple loading component
function LoadingView() {
  return (
    <div className="flex h-[200px] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

// Server Component for fetching and displaying tenant data
async function TenantDetails({ id }: { id: string }) {
  const currentUser = await adminGuard();
  if (!currentUser.success) {
    redirect('/unauthorized');
  }
  
  const supabase = await createServerSupabaseClient();
  
  // Fetch tenant data with admin info
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(`
      id,
      name,
      domain,
      created_at,
      updated_at,
      admin:profiles!tenants_admin_id_fkey (
        id,
        email,
        role
      )
    `)
    .eq('id', id)
    .single();

  if (error || !tenant) {
    notFound();
  }

  // Fetch users belonging to this tenant
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('tenant_id', id);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{tenant.name}</h1>
          <p className="text-muted-foreground">{tenant.domain}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/tenants">Back to Tenants</Link>
          </Button>
          <DeleteTenantButton tenantId={tenant.id} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tenant Information */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p>{tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p>{tenant.updated_at ? new Date(tenant.updated_at).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Domain</p>
              {tenant.domain ? (
                <a 
                  href={`https://${tenant.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {tenant.domain}
                </a>
              ) : (
                <span className="text-muted-foreground">No domain set</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Admin Information */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Admin Email</p>
              <p>{tenant.admin?.email || 'No admin assigned'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Admin Role</p>
              <p className="capitalize">{tenant.admin?.role || 'none'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users ({users?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users?.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p>{user.email}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {user.role}
                    </p>
                  </div>
                </div>
              ))}
              {!users?.length && (
                <p className="text-muted-foreground">No users found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Page Component with Suspense
export default async function Page({ params }: PageProps) {
  // Await the params before using them
  const { id } = await params;
  
  return (
    <Suspense fallback={<LoadingView />}>
      <TenantDetails id={id} />
    </Suspense>
  );
}

// Add metadata with proper params handling
export async function generateMetadata({ params }: PageProps) {
  // Await the params before using them
  const { id } = await params;
  
  const supabase = await createServerSupabaseClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', id)
    .single();

  return {
    title: tenant?.name ? `${tenant.name} - Tenant Details` : 'Tenant Details',
    description: `Management dashboard for tenant ${tenant?.name || id}`
  };
} 