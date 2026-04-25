import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { setMenuButton, setMyCommands, getTmaUrl } from '@/lib/telegram-bot'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bot/setup — register bot commands and menu button.
 * Call once after deployment or when bot settings need to be updated.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const tmaUrl = getTmaUrl()

  const [menuOk, commandsOk] = await Promise.all([
    setMenuButton(tmaUrl),
    setMyCommands(),
  ])

  return NextResponse.json({
    success: menuOk && commandsOk,
    menuButton: menuOk,
    commands: commandsOk,
    tmaUrl,
  })
}
