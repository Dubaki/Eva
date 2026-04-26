import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { setMenuButton, setMyCommands, getTmaUrl, setWebhook } from '@/lib/telegram-bot'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bot/setup — register webhook, bot commands and menu button.
 * Call once after deployment or when bot settings need to be updated.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || getTmaUrl()
  const webhookUrl = `${appUrl}/api/webhook/telegram`

  const [webhookOk, menuOk, commandsOk] = await Promise.all([
    setWebhook({ url: webhookUrl, secretToken: process.env.TELEGRAM_WEBHOOK_SECRET }),
    setMenuButton(appUrl),
    setMyCommands(),
  ])

  return NextResponse.json({
    success: webhookOk && menuOk && commandsOk,
    webhook: webhookOk,
    webhookUrl,
    menuButton: menuOk,
    commands: commandsOk,
  })
}
