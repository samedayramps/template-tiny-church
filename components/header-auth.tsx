'use client';

import { User } from '@supabase/supabase-js'
import { signOutAction } from "@/app/actions/auth";
import { hasEnvVars } from "@/lib/supabase/check-env-vars";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { ThemeSwitcher } from "./theme-switcher";
import { UserRole } from '@/lib/supabase/types'
import { Skeleton } from "./ui/skeleton";

interface AuthButtonProps {
  user: any // Replace with proper user type
  userRole?: UserRole
  isLoading?: boolean
}

export default function AuthButton({ user, userRole, isLoading }: AuthButtonProps) {
  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Skeleton className="h-4 w-20" />
      </Button>
    )
  }

  if (!hasEnvVars) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-sm">
          Update .env.local
        </Badge>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/sign-up">Get Started</Link>
        </Button>
      </div>
    );
  }

  // Get initials from email for avatar fallback
  const initials = user.email 
    ? user.email
        .split('@')[0]
        .split('.')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
    : 'U'; // Fallback to 'U' for User if no email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative h-8 w-8 rounded-full"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.email || 'No email'}</p>
            <p className="text-xs text-muted-foreground">
              {userRole === 'admin' ? 'Admin Account' : 'User Account'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Show admin-specific menu items */}
        {userRole === 'admin' && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin/dashboard">Admin Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <ThemeSwitcher />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={signOutAction} className="w-full">
            <button className="flex w-full items-center text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
