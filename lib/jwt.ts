import { createHmac, timingSafeEqual } from 'crypto'

export interface JwtPayload {
  sub: string
  role: string
  aud: string
  iss: string
  iat: number
  exp: number
  [key: string]: unknown
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
    if (!timingSafeEqual(Buffer.from(sig, 'base64url'), Buffer.from(expectedSig, 'base64url'))) {
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
