const BOT_USERNAME =
  process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'sprosievubot'
const MINI_APP_NAME = 'app'

/**
 * Generates a Telegram referral deep link to the Mini App.
 * Format: https://t.me/sprosievubot/app?startapp=<tgId>
 */
export function getReferralLink(tgId: number): string {
  return `https://t.me/${BOT_USERNAME}/${MINI_APP_NAME}?startapp=${tgId}`
}

/**
 * Opens the Telegram share sheet for the referral link.
 * Uses Telegram WebApp openTelegramLink with t.me/share/url for multi-select forwarding.
 */
export function shareReferralLink(
  link: string,
  text = 'Пройди тест и узнай свою внутреннюю опору',
): void {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
  openInTelegram(shareUrl)
}

function openInTelegram(url: string): void {
  try {
    const tgWebApp = (
      window as unknown as {
        Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } }
      }
    ).Telegram?.WebApp

    if (tgWebApp?.openTelegramLink) {
      tgWebApp.openTelegramLink(url)
      return
    }
  } catch {
    // not in TMA
  }

  // Final fallback
  navigator.clipboard.writeText(url.split('?')[0]).catch(() => { /* ignore */ })
  window.open(url, '_blank')
}
