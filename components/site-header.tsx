import Link from "next/link";
import AuthButton from "@/components/header-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";

export async function SiteHeader() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex flex-1 items-center justify-between">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-3 font-semibold"
          >
            <Logo className="h-8 w-8 text-foreground" />
            <span>Tiny Church</span>
          </Link>

          {/* Navigation and Actions */}
          <div className="flex items-center gap-2">
            <AuthButton user={user} />
          </div>
        </div>
      </div>
    </header>
  );
} 