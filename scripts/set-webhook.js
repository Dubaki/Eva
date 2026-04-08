#!/usr/bin/env node
/**
 * set-webhook.js
 *
 * Registers the Telegram bot webhook URL.
 *
 * Usage:
 *   npm run webhook https://your-app.vercel.app
 *   node scripts/set-webhook.js https://your-app.vercel.app
 *
 * Reads BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from .env.local
 */

const path = require('path')

// ── Load .env.local ────────────────────────────────────────────────────────
const dotenvPath = path.resolve(__dirname, '..', '.env.local')
try {
  require('dotenv').config({ path: dotenvPath })
  console.log('✅ Loaded .env.local:', dotenvPath)
} catch (err) {
  console.warn('⚠️  Could not load .env.local:', err.message)
}

// ── Validate inputs ────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET
const VERCEL_URL = process.argv[2]

console.log('')
console.log('═══════════════════════════════════════════')
console.log('   EVA — Telegram Webhook Registration')
console.log('═══════════════════════════════════════════')
console.log('')

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env.local')
  console.error('   Add your bot token to .env.local and try again.')
  process.exit(1)
}

if (!VERCEL_URL) {
  console.error('❌ Missing Vercel URL')
  console.error('')
  console.error('Usage:')
  console.error('  npm run webhook https://your-app.vercel.app')
  console.error('')
  console.error('Get your URL from Vercel Dashboard → Domains')
  process.exit(1)
}

// Normalize URL — ensure https:// prefix
let webhookUrl = VERCEL_URL
if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
  webhookUrl = 'https://' + webhookUrl
}
// Remove trailing slash
webhookUrl = webhookUrl.replace(/\/$/, '') + '/api/webhook/telegram'

console.log('📡 Webhook URL:', webhookUrl)
console.log('🔑 Bot Token:', BOT_TOKEN.substring(0, 12) + '...')
console.log('🔒 Secret:', SECRET_TOKEN ? '***configured***' : '(not set)')
console.log('')

// ── Build request ──────────────────────────────────────────────────────────

const requestBody = {
  url: webhookUrl,
  allowed_updates: ['message', 'my_chat_member'],
}

if (SECRET_TOKEN) {
  requestBody.secret_token = SECRET_TOKEN
}

console.log('📤 Sending setWebhook request to Telegram...')
console.log('')

// ── Send request ───────────────────────────────────────────────────────────

async function main() {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ HTTP Error:', response.status, response.statusText)
      console.error('Response:', JSON.stringify(data, null, 2))
      process.exit(1)
    }

    if (!data.ok) {
      console.error('❌ Telegram API returned error:')
      console.error('')
      console.error('  Description:', data.description || 'Unknown error')
      console.error('  Error Code:', data.error_code || 'N/A')
      console.error('')
      console.error('Common issues:')
      console.error('  • Invalid BOT_TOKEN')
      console.error('  • URL is not HTTPS')
      console.error('  • URL is not accessible from the internet')
      process.exit(1)
    }

    // ── Success ───────────────────────────────────────────────────────────

    console.log('✅ Webhook registered successfully!')
    console.log('')
    console.log('─────────────────────────────────────────')
    console.log('  Bot:', data.result?.bot?.username || BOT_TOKEN.substring(0, 10) + '...')
    console.log('  URL:', data.result.url)
    console.log('  Pending Updates:', data.result.pending_update_count ?? 0)
    console.log('  Max Connections:', data.result.max_connections ?? 'default')
    if (data.result.last_error_date) {
      console.log('  Last Error:', data.result.last_error_message || 'N/A')
    }
    console.log('─────────────────────────────────────────')
    console.log('')
    console.log('🎉 Next steps:')
    console.log('')
    console.log('  1. Open Telegram and find your bot')
    console.log('  2. Send /start to test it')
    console.log('  3. You should see a welcome message with a button')
    console.log('')
    console.log('To remove the webhook later:')
    console.log(`  curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook"`)
    console.log('')

  } catch (err) {
    console.error('❌ Network Error:', err.message)
    console.error('')
    console.error('Check your internet connection and try again.')
    console.error('If behind a proxy, ensure NODE_TLS_REJECT_UNAUTHORIZED is not set to 0.')
    process.exit(1)
  }
}

main()
