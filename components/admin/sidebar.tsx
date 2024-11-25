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
  Menu,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { signOutAction } from "@/actions/auth"
import { Suspense, useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useMediaQuery } from "@/hooks/use-media-query"
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
    <div className="flex flex-col gap-2 px-2">
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
}: { 
  item: NavItem
  pathname: string
  onNavigate?: () => void
}) {
  if (item.disabled) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start opacity-50 cursor-not-allowed"
        disabled
      >
        <item.icon className="mr-2 h-4 w-4" />
        {item.title}
      </Button>
    )
  }

  return (
    <Link 
      href={item.href}
      onClick={onNavigate}
      className="w-full"
    >
      <Button
        variant={pathname === item.href ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start",
          pathname === item.href && "bg-primary/10 dark:bg-primary/20",
        )}
      >
        <item.icon className="mr-2 h-4 w-4" />
        {item.title}
        {item.href === pathname && (
          <span className="ml-auto h-1 w-1 rounded-full bg-primary" />
        )}
      </Button>
    </Link>
  )
}

function SidebarContent({ 
  pathname,
  onNavigate,
}: { 
  pathname: string
  onNavigate?: () => void
}) {
  const [userRole, setUserRole] = useState<UserRole>()
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        setIsLoading(true)
        const supabase = createClientSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          
          if (error) throw error
          setUserRole(profileData?.role as UserRole)
        }
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
  }, [toast])

  // Memoize filtered items
  const filteredNavItems = useMemo(() => {
    return mainNavItems.filter(item => {
      if (!item.role) return true
      if (!userRole) return true
      return Array.isArray(item.role)
        ? item.role.includes(userRole)
        : item.role === userRole
    })
  }, [userRole])

  if (isLoading) {
    return <SidebarSkeleton />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-2 px-2">
          <div className="flex items-center gap-2 font-semibold text-xl">
            <LayoutDashboard className="h-6 w-6" />
            <span>Admin Panel</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <Suspense fallback={<SidebarSkeleton />}>
          <div className="space-y-1">
            {filteredNavItems.map((item: NavItem) => (
              <NavLink 
                key={item.href}
                item={item} 
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </Suspense>
      </ScrollArea>

      <div className="border-t p-4">
        <form action={signOutAction}>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            type="submit"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
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

  return (
    <div 
      className={cn(
        "flex flex-col h-full border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <SidebarContent 
        pathname={pathname}
        onNavigate={onNavigate}
      />
    </div>
  )
} 