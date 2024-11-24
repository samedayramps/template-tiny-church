import { Sidebar } from "@/components/admin/sidebar"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  
  // Verify admin access
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect('/sign-in')
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    redirect('/unauthorized')
  }

  return (
    <div className="flex h-screen">
      <Sidebar className="w-64 hidden md:block" />
      
      {/* Mobile sidebar - shown/hidden based on state */}
      <div className="md:hidden">
        <Sidebar className="fixed inset-y-0 w-64 transition-transform duration-300 ease-in-out transform -translate-x-full sm:translate-x-0" />
      </div>

      <div className="flex-1 flex flex-col">
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
} 