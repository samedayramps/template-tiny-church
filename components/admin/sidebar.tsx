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
  ChevronDown,
  Building,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { signOutAction } from "@/app/actions/auth"

const sidebarNavItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Tenants",
    href: "/admin/tenants",
    icon: Building,
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn(
      "flex flex-col h-full border-r bg-white dark:bg-gray-800/40 shadow-sm",
      className
    )}>
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center gap-2 px-2">
          <div className="flex items-center gap-2 font-semibold text-xl">
            <LayoutDashboard className="h-6 w-6" />
            <span>Admin Panel</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1">
          {sidebarNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  pathname === item.href && "bg-primary/10 dark:bg-primary/20"
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
                {item.href === pathname && (
                  <div className="ml-auto h-1 w-1 rounded-full bg-primary" />
                )}
              </Button>
            </Link>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4">
        <form action={signOutAction}>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  )
} 