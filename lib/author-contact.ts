import WebApp from '@twa-dev/sdk'

/**
 * Global helper: track author contact clicks.
 * Fires a fire-and-forget request to mark `contact_author_clicked = true`,
 * then immediately opens the Telegram link to the author.
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
        }).catch(() => { /* silent */ })
      }
    }
  } catch {
    /* ignore */
  }

  // Always open the link
  const url = prefill
    ? `https://t.me/${AUTHOR_USERNAME}?text=${encodeURIComponent(prefill)}`
    : `https://t.me/${AUTHOR_USERNAME}`

  try {
    WebApp.openTelegramLink(url)
    
    // Auto-close Mini App after a short delay so the user lands in the chat
    setTimeout(() => {
      WebApp.close()
    }, 1000)
  } catch (err) {
    console.error('[openAuthorContact] WebApp navigation failed:', err)
    window.open(url, '_blank')
  }
}

export { AUTHOR_USERNAME }
