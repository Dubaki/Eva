import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware that excludes static files (images, fonts, etc.) from any processing.
 * This ensures Telegram can download images directly without getting HTML responses.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  // Match all routes EXCEPT static files and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
