'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import AuthButton from "@/components/header-auth"

import { UserRole } from "@/lib/data/supabase/types"
import { LayoutDashboard, Menu } from "lucide-react"
import { Button } from "./ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useState, useEffect } from "react"
import { createClientSupabaseClient } from "@/lib/data/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Sidebar } from "./admin/sidebar"
import { DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"

interface SiteHeaderProps {
  user: any
  initialRole?: UserRole
  className?: string
}

export function SiteHeader({ user, initialRole, className }: SiteHeaderProps) {
  const [userRole, setUserRole] = useState<UserRole | undefined>(initialRole)
  const [isLoading, setIsLoading] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const { toast } = useToast()
  const isAdminRoute = pathname?.startsWith('/admin')

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const fetchUserRole = async () => {
      if (initialRole || !user) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const supabase = createClientSupabaseClient()
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (error) throw error
        setUserRole(profileData?.role as UserRole)
      } catch (error) {
        console.error('Error fetching user role:', error)
        toast({
          title: "Error",
          description: "Failed to fetch user role",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserRole()
  }, [user, initialRole, toast])

  return (
    <>
      <header className={cn(
        "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}>
        <div className="container flex h-14 items-center justify-between">
          {/* Left side - Logo and Mobile Menu */}
          <div className="flex items-center gap-4">
            {isAdminRoute && !isDesktop && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            
            <Link 
              href="/" 
              className="flex items-center gap-2"
            >
              <div className="relative h-8 w-8">
                <Image 
                  src="/logo.svg" 
                  alt="Tiny Church Logo"
                  fill
                  priority
                  className="dark:invert"
                  sizes="32px"
                  aria-hidden="true"
                />
              </div>
              <span className="font-semibold">Tiny Church</span>
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {userRole === UserRole.ADMIN && !isAdminRoute && (
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
            {!user && (
              <Link href="/auth/sign-in">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
            )}
            {user && (
              <AuthButton 
                user={user} 
                userRole={userRole} 
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Sheet - Only show on admin routes */}
      {isAdminRoute && (
        <Sheet 
          open={isMobileMenuOpen} 
          onOpenChange={setIsMobileMenuOpen}
        >
          <SheetContent 
            side="left" 
            className="p-0 w-[280px]"
          >
            <div className="flex items-center p-4">
              <DialogTitle className="text-lg font-semibold">
                Menu
              </DialogTitle>
            </div>
            
            <Sidebar 
              className="border-none" 
              onNavigate={() => setIsMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
} 