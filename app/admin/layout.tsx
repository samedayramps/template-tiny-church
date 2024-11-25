import { Sidebar } from "@/components/admin/sidebar"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // We can trust the user is admin because middleware handles the protection
  return (
    <div className="flex h-screen">
      <Sidebar className="w-64 hidden md:block" />
      <div className="flex-1 flex flex-col">
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
} 