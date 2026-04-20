import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyJwt } from '@/lib/jwt'
import { calculateScores, type Answer } from '@/lib/scoring'
import { QUESTIONS } from '@/lib/questions'
import { FULL_RESULTS_TEXTS } from '@/lib/constants/results'
import { sendPhoto, sendMessage } from '@/lib/telegram-bot'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) return NextResponse.json({ success: false, error: 'Config error' }, { status: 500 })

  try {
    const body = await request.json()
    const answers: Answer[] = body.answers
    const bodyTgId = body.tgId
    
    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
      return NextResponse.json({ success: false, error: 'Invalid answers count' }, { status: 400 })
    }

    let profileId: string | null = null
    let tgId: number | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const payload = verifyJwt(token, jwtSecret)
      if (payload?.sub) profileId = payload.sub
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    if (profileId) {
      const { data } = await supabaseAdmin.from('profiles').select('tg_id').eq('id', profileId).limit(1)
      if (data && data.length > 0) tgId = data[0].tg_id
    }

    if (!tgId && bodyTgId) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, tg_id').eq('tg_id', bodyTgId).limit(1)
      if (profiles && profiles.length > 0) {
        profileId = profiles[0].id
        tgId = profiles[0].tg_id
      }
    }

    if (!profileId || !tgId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const scores = calculateScores(answers)
    const primary = scores.dominantTrait.toUpperCase()
    const secondary = scores.secondaryTrait.toUpperCase()

    const { error: dbError } = await supabaseAdmin.rpc('save_test_result', {
      p_tg_id: tgId, p_primary_support: primary, p_secondary_support: secondary,
    })
    if (dbError) return NextResponse.json({ success: false, error: dbError.message }, { status: 500 })

    await supabaseAdmin.from('profiles').update({ current_step: null, question_order: null }).eq('id', profileId)
    
    // ── Настройка Telegram ──
    const fullText = FULL_RESULTS_TEXTS[primary]
    const TRAIT_IMAGES_MAP: Record<string, string> = {
      S: 'hero.png', 
      U: 'pleaser.png', 
      P: 'perfectionist.png', 
      R: 'stayer.png', 
      K: 'controller.png'
    }

    const imageName = TRAIT_IMAGES_MAP[primary] || 'hero.png'

    // Используем прямые ссылки на Raw контент GitHub как резервный (fallback) 
    // Это гарантирует, что Telegram увидит фото, даже если Vercel домен еще не подтвержден
    const githubRawBase = 'https://raw.githubusercontent.com/Dubaki/Eva/main/public'
    const photoUrl = `${githubRawBase}/${imageName}`

    try {
      // 1. Отправляем фото по прямой ссылке
      await sendPhoto({ 
        chatId: tgId, 
        photo: photoUrl 
      });
      
      // 2. Сразу следом отправляем текст
      await sendMessage({
        chatId: tgId,
        text: fullText,
        parseMode: 'HTML'
      });
      
      console.log(`[API] Result sent to TG. Trait: ${primary}, Photo: ${photoUrl}`);
    } catch (err) {
      console.error('[API] Telegram delivery critical error:', err);
    }

    return NextResponse.json({ success: true, data: { dominantTrait: scores.dominantTrait, scores } })
  } catch (err) {
    console.error('[API] Submit error:', err)
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 })
  }
}