const BOT_USERNAME =
  process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'sprosievubot'

/**
 * Generates a Telegram referral deep link.
 * Format: https://t.me/sprosievubot?start=ref_<tgId>
 */
export function getReferralLink(tgId: number): string {
  return `https://t.me/${BOT_USERNAME}?start=ref_${tgId}`
}

/**
 * Opens the Telegram share sheet for the referral link.
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

  navigator.clipboard.writeText(link).catch(() => {
    window.open(shareUrl, '_blank')
  })
}
