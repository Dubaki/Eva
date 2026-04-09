const BOT_USERNAME =
  process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'test_opor_bot'

const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME ?? ''

/**
 * Generates a Telegram Mini App deep link with startapp param.
 * Format: https://t.me/<BOT>/<APP>?startapp=ref_<tgId>
 */
export function getReferralLink(tgId: number): string {
  const base = APP_NAME
    ? `https://t.me/${BOT_USERNAME}/${APP_NAME}`
    : `https://t.me/${BOT_USERNAME}`
  return `${base}?startapp=ref_${tgId}`
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
