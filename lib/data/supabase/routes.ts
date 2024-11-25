import { UserRole } from './types'

export const ROLE_ROUTES: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '/admin',
  [UserRole.ADMIN]: '/admin/dashboard',
  [UserRole.USER]: '/protected/dashboard',
  [UserRole.GUEST]: '/protected/dashboard'
} as const

export const DEFAULT_REDIRECT = '/protected' 