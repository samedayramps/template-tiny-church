import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createServerSupabaseClient } from "@/lib/data/supabase/server"
import { Users, UserCheck, UserPlus, ArrowUpRight } from "lucide-react"

export default async function AdminDashboard() {
  const supabase = await createServerSupabaseClient()
  
  const { data: stats } = await supabase
    .from('user_roles')
    .select('role')

  const totalUsers = stats?.length || 0
  const activeUsers = stats?.filter(user => user.role === 'user').length || 0
  const pendingUsers = stats?.filter(user => user.role === 'guest').length || 0

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <span className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </span>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{totalUsers}</div>
              <div className="text-xs text-muted-foreground">
                <ArrowUpRight className="h-4 w-4 inline-block" />
                +12% from last month
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{activeUsers}</div>
              <div className="text-xs text-muted-foreground">
                <ArrowUpRight className="h-4 w-4 inline-block" />
                +5% from last week
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Users</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{pendingUsers}</div>
              <div className="text-xs text-muted-foreground">
                <ArrowUpRight className="h-4 w-4 inline-block" />
                New requests
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 