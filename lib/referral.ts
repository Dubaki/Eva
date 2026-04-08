const BOT_USERNAME =
  process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'eva_bot'

/**
 * Generates a Telegram deep link that passes the user's tg_id as a start param.
 * When a friend opens this link, the bot receives /start ref{tgId}.
 */
export function getReferralLink(tgId: number): string {
  return `https://t.me/${BOT_USERNAME}?start=ref${tgId}`
}

/**
 * Opens the Telegram share sheet for the referral link.
 * In TMA: uses WebApp.openTelegramLink (native share).
 * In browser (dev/desktop): falls back to clipboard.
 */
export function shareReferralLink(
  link: string,
  text = 'Пройди тест и узнай свою внутреннюю опору',
): void {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`

  try {
    const tgWebApp = (
      window as unknown as {
        Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } }
      }
    ).Telegram?.WebApp

    if (tgWebApp?.openTelegramLink) {
      tgWebApp.openTelegramLink(shareUrl)
      return
    }
  } catch {
    // not in TMA
  }

  // Fallback for dev / desktop browser
  navigator.clipboard.writeText(link).catch(() => {
    window.open(shareUrl, '_blank')
  })
}
