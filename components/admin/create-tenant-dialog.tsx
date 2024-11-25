"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { createTenant } from "@/actions/tenant/create"
import { createClientSupabaseClient } from "@/lib/data/supabase/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  name: z.string().min(1, "Tenant name is required"),
  adminId: z.string().uuid("Invalid admin ID"),
})

export function CreateTenantDialog() {
  const [open, setOpen] = useState(false)
  const [admins, setAdmins] = useState<{ id: string; email: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  
  // Fetch available admin users
  useEffect(() => {
    const fetchAdmins = async () => {
      const supabase = createClientSupabaseClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'admin')
        .is('tenant_id', null) // Only get admins not assigned to a tenant
      
      if (data) {
        setAdmins(data)
      }
    }
    
    if (open) {
      fetchAdmins()
    }
  }, [open])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      adminId: "",
    },
  })

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', values.name)
      formData.append('adminId', values.adminId)
      
      await createTenant(formData)
      
      // Reset form and close dialog before refresh
      form.reset()
      setOpen(false)
      
      // Refresh the page data
      router.refresh()
    } catch (error) {
      if (error && 
          typeof error === 'object' && 
          'digest' in error && 
          typeof (error as { digest: string }).digest === 'string' && 
          (error as { digest: string }).digest.includes('success')) {
        // Success redirect, close the dialog
        form.reset()
        setOpen(false)
        throw error
      }
      
      console.error('Error creating tenant:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Tenant</DialogTitle>
          <DialogDescription>
            Create a new tenant and assign an admin user.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenant Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter tenant name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="adminId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin User</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {admins.map((admin) => (
                        <SelectItem key={admin.id} value={admin.id}>
                          {admin.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={isLoading || form.formState.isSubmitting}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Tenant'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
} 