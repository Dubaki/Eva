/**
 * Global helper: track author contact clicks and open Telegram.
 */

const AUTHOR_USERNAME = 'evapatrakhina'

/**
 * Opens a Telegram DM to the author, tracking the click in the DB.
 *
 * @param prefill - Optional prefill text appended to the URL as `?text=...`
 */
export function openAuthorContact(prefill?: string): void {
  // SSR check
  if (typeof window === 'undefined') return;

  const WebApp = (window as any).Telegram?.WebApp;
  const tgId = WebApp?.initDataUnsafe?.user?.id;

  // Track the click in DB (fire-and-forget)
  const trackContact = async () => {
    let finalTgId = tgId;

    // Fallback to localStorage if WebApp ID is missing
    if (!finalTgId) {
      try {
        const profileRaw = localStorage.getItem('eva_profile');
        if (profileRaw) {
          const p = JSON.parse(profileRaw) as { tg_id?: number };
          if (p.tg_id) finalTgId = p.tg_id;
        }
      } catch { /* ignore */ }
    }

    if (finalTgId) {
      try {
        await fetch('/api/user/contact-author', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tgId: finalTgId }),
        });
      } catch (err) {
        console.error('[openAuthorContact] Tracking failed:', err);
      }
    }
  };

  trackContact();

  // Open the Telegram link
  const url = prefill
    ? `https://t.me/${AUTHOR_USERNAME}?text=${encodeURIComponent(prefill)}`
    : `https://t.me/${AUTHOR_USERNAME}`;

  try {
    if (WebApp?.openTelegramLink) {
      WebApp.openTelegramLink(url);
      // Auto-close Mini App after a short delay so the user lands in the chat
      setTimeout(() => {
        WebApp.close();
      }, 1000);
    } else {
      window.open(url, '_blank');
    }
  } catch (err) {
    console.error('[openAuthorContact] WebApp navigation failed:', err);
    window.open(url, '_blank');
  }
}

export { AUTHOR_USERNAME };
