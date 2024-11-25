import { Sidebar } from "@/components/admin/sidebar"
import { createServerSupabaseClient } from "@/lib/data/supabase/server"
import { ImpersonationWrapper } from "@/components/layouts/impersonation-wrapper"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <Sidebar className="hidden md:block" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ImpersonationWrapper>
          <main className="flex-1 overflow-y-auto p-6 md:ml-0 transition-all duration-300">
            {children}
          </main>
        </ImpersonationWrapper>
      </div>
    </div>
  );
} 