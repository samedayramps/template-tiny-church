import { Database } from './database.types'

export type Tables = Database['public']['Tables']

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest'
}

// Type for the user_roles table
export type UserRoleData = Tables['user_roles']['Row']

// Type for the profiles table
export type Profile = Tables['profiles']['Row']

// Type for impersonation sessions
export type ImpersonationSession = Tables['impersonation_sessions']['Row']

// Helper type for Supabase row data with nested auth.users
export interface UserRoleWithAuth {
  id: string;
  email: string;
  role: Database['public']['Enums']['user_role'];
  updated_at: string;
  metadata: {
    tenant_name?: string;
    [key: string]: any;
  } | null;
  raw_user_meta_data: Database['public']['Tables']['profiles']['Row']['raw_user_meta_data'];
  tenants?: {
    id: string;
    name: string;
  } | null;
  tenant_id?: string | null;
}

// Type for the response from get_active_impersonation RPC
export type ActiveImpersonation = Database['public']['Functions']['get_active_impersonation']['Returns']

// Type for database functions
export type DatabaseFunctions = {
  get_active_impersonation: () => Promise<ActiveImpersonation>;
  verify_user_roles_setup: () => Promise<Database['public']['Functions']['verify_user_roles_setup']['Returns']>;
  create_password_reset_token: (args: { user_email: string }) => Promise<string>;
} 