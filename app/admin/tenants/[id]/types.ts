import { Database } from "@/lib/data/supabase/database.types";

export type TenantWithAdmin = Database['public']['Tables']['tenants']['Row'] & {
  admin: Database['public']['Tables']['profiles']['Row'] | null;
};

export type TenantUser = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'email' | 'role'
>; 