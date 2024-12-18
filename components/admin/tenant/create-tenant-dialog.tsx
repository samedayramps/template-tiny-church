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
  domain: z.string()
    .min(1, "Domain is required")
    .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i, {
      message: "Please enter a valid domain name (e.g. example.com)"
    })
})

export function CreateTenantDialog() {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<{ id: string; email: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  
  // Fetch available users
  useEffect(() => {
    const fetchUsers = async () => {
      const supabase = createClientSupabaseClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'user')
        .is('tenant_id', null)
      
      if (data) {
        setUsers(data)
      }
    }
    
    if (open) {
      fetchUsers()
    }
  }, [open])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      adminId: "",
      domain: "",
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
      formData.append('domain', values.domain)
      
      // Reset form and close dialog before the action
      form.reset()
      setOpen(false)
      
      // Execute the server action
      await createTenant(formData)
      
      // Refresh the page data
      router.refresh()
    } catch (error) {
      setIsLoading(false)
      
      // Check if this is a redirect response
      if (error && 
          typeof error === 'object' && 
          'digest' in error && 
          typeof (error as { digest: string }).digest === 'string') {
        const digest = (error as { digest: string }).digest
        
        // Only throw the error if it's a success redirect
        if (digest.includes('success')) {
          throw error
        }
        
        // For error redirects, reopen the dialog and show the form
        setOpen(true)
        form.reset(values) // Restore the form values
      } else {
        console.error('Error creating tenant:', error)
        setOpen(true)
        form.reset(values) // Restore the form values
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Tenant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Tenant</DialogTitle>
          <DialogDescription>
            Create a new tenant organization with a unique name and domain.
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
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="example.com" 
                      {...field}
                      onChange={(e) => {
                        // Only convert to lowercase, allow dots
                        const value = e.target.value.toLowerCase();
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground">
                    Enter a bare domain name without http:// or www (e.g. example.com)
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adminId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenant Admin</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
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