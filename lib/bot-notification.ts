/**
 * Helper to invoke the Supabase Edge Function `process-bot-notifications`.
 * Used server-side after DB mutations to trigger Telegram bot messages.
 */

export async function triggerBotNotification(payload: {
  event: 'dominant_trait_set' | 'referrals_reached_2'
  profile_id: string
  tg_id: number
  trait?: string
  mixed_trait?: string
}): Promise<boolean> {
  const edgeFnUrl = process.env.SUPABASE_EDGE_FUNCTION_URL
  if (!edgeFnUrl) {
    // Edge Function URL not configured — silently skip
    console.warn('[bot-notification] SUPABASE_EDGE_FUNCTION_URL not set, skipping')
    return false
  }

  try {
    const res = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[bot-notification] Edge function call failed (${res.status}):`, errText)
      return false
    }
    return true
  } catch (err) {
    console.error('[bot-notification] Edge function invocation error:', err)
    return false
  }
}
