import { createHmac, timingSafeEqual } from 'crypto'

export interface JwtPayload {
  sub: string
  role?: string
  aud?: string
  iss?: string
  iat: number
  exp: number
  [key: string]: unknown
}

/**
 * Signs a payload as an HS256 JWT using the provided secret.
 */
export function signJwt(payload: Omit<JwtPayload, 'iat'>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const iat = Math.floor(Date.now() / 1000)
  const fullPayload = { ...payload, iat }

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url')
  
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url')

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

/**
 * Verifies an HS256 JWT signed with the provided secret.
 * Returns the decoded payload, or null if invalid / expired.
 */
export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, payload, sig] = parts

  // Verify signature
  const expectedSig = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  try {
    const bSig = Buffer.from(sig, 'base64url')
    const bExp = Buffer.from(expectedSig, 'base64url')
    if (bSig.length !== bExp.length || !timingSafeEqual(bSig, bExp)) {
      return null
    }
  } catch {
    return null
  }

  // Decode payload
  let decoded: JwtPayload
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as JwtPayload
  } catch {
    return null
  }

  // Check expiry
  if (typeof decoded.exp === 'number' && decoded.exp < Math.floor(Date.now() / 1000)) {
    return null
  }

  return decoded
}
