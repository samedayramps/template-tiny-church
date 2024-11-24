import { Database } from './database.types'

type UserRole = Database['public']['Enums']['user_role']

export const ROLE_ROUTES: Record<UserRole, string> = {
  admin: '/admin',
  user: '/protected',
  guest: '/welcome'
} as const

export const DEFAULT_REDIRECT = '/' 