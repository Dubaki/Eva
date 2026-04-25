import { NextRequest } from 'next/server'
import { verifyJwt } from './jwt'

/**
 * Checks if the request has a valid admin JWT token.
 */
export function isAdminAuthenticated(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const token = authHeader.slice(7)
  const jwtSecret = process.env.EVA_JWT_SECRET || process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) return false

  const payload = verifyJwt(token, jwtSecret)
  return payload?.role === 'admin'
}
