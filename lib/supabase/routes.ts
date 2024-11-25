import { UserRole } from './types'

export const ROLE_ROUTES: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '/admin',
  [UserRole.ADMIN]: '/admin',
  [UserRole.USER]: '/protected',
  [UserRole.GUEST]: '/protected'
} as const

export const DEFAULT_REDIRECT = '/protected' 