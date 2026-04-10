import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

/**
 * GET /api/gift-link?key=gift_money — получить ссылку на подарок из app_settings
 * Публичный endpoint (без авторизации, т.к. ссылки не секретные)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')

  if (!key || !['gift_money', 'gift_relations', 'gift_health', 'gift_other'].includes(key)) {
    return NextResponse.json({ success: false, error: 'Invalid key' }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single()

  if (error || !data) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: { url: data.value } })
}
