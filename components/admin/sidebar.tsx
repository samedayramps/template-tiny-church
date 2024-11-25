'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart,
  LogOut,
  Building,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { signOutAction } from "@/actions/auth"
import { Suspense, useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useState, useEffect } from "react"
import { UserRole } from "@/lib/data/supabase/types"
import { createClientSupabaseClient } from "@/lib/data/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  disabled?: boolean
  role?: UserRole | UserRole[]
}

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    role: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
    role: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  },
  {
    title: "Tenants",
    href: "/admin/tenants",
    icon: Building,
    role: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart,
    disabled: true,
    role: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2" role="status" aria-label="Loading sidebar">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

function NavLink({ 
  item, 
  pathname,
  onNavigate,
  isCollapsed,
}: { 
  item: NavItem
  pathname: string
  onNavigate?: () => void
  isCollapsed: boolean
}) {
  const isActive = pathname === item.href
  const buttonClasses = cn(
    "w-full relative transition-colors",
    isCollapsed ? "justify-center px-2" : "justify-start",
    isActive && "bg-primary/10 dark:bg-primary/20",
    item.disabled && "opacity-50 cursor-not-allowed"
  )

  if (item.disabled) {
    return (
      <Button
        variant="ghost"
        className={buttonClasses}
        disabled
        aria-disabled="true"
      >
        <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} aria-hidden="true" />
        {!isCollapsed && <span>{item.title}</span>}
      </Button>
    )
  }

  return (
    <Link 
      href={item.href}
      onClick={onNavigate}
      className="w-full"
      aria-current={isActive ? "page" : undefined}
    >
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={buttonClasses}
      >
        <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} aria-hidden="true" />
        {!isCollapsed && <span>{item.title}</span>}
        {isActive && (
          <span 
            className={cn(
              "h-1 w-1 rounded-full bg-primary transition-all",
              isCollapsed ? "absolute right-2" : "ml-auto"
            )} 
            aria-hidden="true"
          />
        )}
      </Button>
    </Link>
  )
}

function SidebarContent({ 
  pathname,
  onNavigate,
  isCollapsed,
}: { 
  pathname: string
  onNavigate?: () => void
  isCollapsed: boolean
}) {
  const [userRole, setUserRole] = useState<UserRole>()
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    let mounted = true

    const fetchUserRole = async () => {
      try {
        setIsLoading(true)
        const supabase = createClientSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!mounted) return

        if (user) {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          
          if (error) throw error
          if (mounted) {
            setUserRole(profileData?.role as UserRole)
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
        toast({
          title: "Error",
          description: "Failed to fetch user role",
          variant: "destructive",
        })
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchUserRole()
    return () => { mounted = false }
  }, [toast])

  const filteredNavItems = useMemo(() => {
    return mainNavItems.filter(item => {
      if (!item.role) return true
      if (!userRole) return true
      return Array.isArray(item.role)
        ? item.role.includes(userRole)
        : item.role === userRole
    })
  }, [userRole])

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className={cn("flex-1", isCollapsed ? "px-2" : "px-3")}>
        <Suspense fallback={<SidebarSkeleton />}>
          <nav className="space-y-1 py-4">
            {filteredNavItems.map((item) => (
              <NavLink 
                key={item.href}
                item={item} 
                pathname={pathname}
                onNavigate={onNavigate}
                isCollapsed={isCollapsed}
              />
            ))}
          </nav>
        </Suspense>
      </ScrollArea>

      <div className={cn("border-t", isCollapsed ? "p-2" : "p-4")}>
        <form action={signOutAction}>
          <Button 
            variant="ghost" 
            className={cn(
              "w-full text-muted-foreground hover:text-destructive transition-colors",
              isCollapsed ? "justify-center px-2" : "justify-start"
            )}
            type="submit"
          >
            <LogOut className={cn("h-4 w-4", !isCollapsed && "mr-2")} aria-hidden="true" />
            {!isCollapsed && <span>Sign Out</span>}
          </Button>
        </form>
      </div>
    </div>
  )
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  onNavigate?: () => void
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <aside 
      className={cn(
        "flex flex-col h-full border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "transition-all duration-300 ease-in-out will-change-[width]",
        "group hover:w-[240px]",
        isCollapsed ? "w-[70px]" : "w-[240px]",
        className
      )}
      aria-label="Sidebar navigation"
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <SidebarContent 
        pathname={pathname}
        onNavigate={onNavigate}
        isCollapsed={isCollapsed}
      />
    </aside>
  )
} 