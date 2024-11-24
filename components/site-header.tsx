import Link from "next/link";
import AuthButton from "@/components/header-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { UserRole } from "@/lib/supabase/types";
import { LayoutDashboard } from "lucide-react";
import { Button } from "./ui/button";

export async function SiteHeader() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  let userRole: UserRole | undefined;
  if (user) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single();
    userRole = roleData?.role as UserRole;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex flex-1 items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 font-semibold">
            <Logo className="h-8 w-8 text-foreground" />
            <span>Tiny Church</span>
          </Link>

          <div className="flex items-center gap-2">
            {userRole === UserRole.ADMIN && (
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
            <AuthButton user={user} userRole={userRole} />
          </div>
        </div>
      </div>
    </header>
  );
} 