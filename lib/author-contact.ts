/**
 * Global helper: track author contact clicks.
 * Fires a fire-and-forget request to mark `contact_author_clicked = true`,
 * then immediately opens the Telegram link to the author.
 *
 * The navigation is NEVER blocked by the DB request — it runs independently.
 */

const AUTHOR_USERNAME = 'evapatrakhina'

/**
 * Opens a Telegram DM to the author, tracking the click in the DB.
 *
 * @param prefill - Optional prefill text appended to the URL as `?text=...`
 */
export function openAuthorContact(prefill?: string): void {
  // Fire-and-forget: mark contact in DB
  try {
    const profileRaw = typeof localStorage !== 'undefined'
      ? localStorage.getItem('eva_profile')
      : null
    if (profileRaw) {
      const p = JSON.parse(profileRaw) as { tg_id?: number }
      if (p.tg_id) {
        fetch('/api/user/contact-author', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tgId: p.tg_id }),
        }).catch(() => { /* silent — don't block navigation */ })
      }
    }
  } catch {
    /* ignore — never block navigation */
  }

  // Always open the link immediately
  const url = prefill
    ? `https://t.me/${AUTHOR_USERNAME}?text=${encodeURIComponent(prefill)}`
    : `https://t.me/${AUTHOR_USERNAME}`

  try {
    const tgWebApp = (
      window as unknown as {
        Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } }
      }
    ).Telegram?.WebApp

    if (tgWebApp?.openTelegramLink) {
      tgWebApp.openTelegramLink(url)
    } else {
      window.open(url, '_blank')
    }
  } catch {
    window.open(url, '_blank')
  }
}

export { AUTHOR_USERNAME }
