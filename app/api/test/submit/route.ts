import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { calculateScores, type Answer } from '@/lib/scoring'
import { triggerBotNotification } from '@/lib/bot-notification'
import { createClient } from '@supabase/supabase-js'
import { verifyJwt } from '@/lib/jwt'
import { QUESTIONS } from '@/lib/questions'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })

  try {
    const body = await request.json()
    const answers: Answer[] = body.answers
    const bodyTgId = body.tgId
    
    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
      return NextResponse.json({ success: false, error: 'Неверное количество ответов' }, { status: 400 })
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
      const { data } = await supabaseAdmin.from('profiles').select('tg_id').eq('id', profileId).single()
      if (data) tgId = data.tg_id
    } else if (bodyTgId) {
      // Ищем профиль
      const { data: profile } = await supabaseAdmin.from('profiles').select('id, tg_id').eq('tg_id', bodyTgId).single()
      
      if (profile) {
        profileId = profile.id
        tgId = profile.tg_id
      } else {
        // ЖЕСТКАЯ АВТОРЕГИСТРАЦИЯ ЕСЛИ ПРОФИЛЯ НЕТ
        const { data: newProfile, error } = await supabaseAdmin.from('profiles')
          .insert([{ tg_id: bodyTgId, is_subscribed: true }])
          .select('id, tg_id').single()
        
        if (newProfile) {
          profileId = newProfile.id
          tgId = newProfile.tg_id
        } else {
          return NextResponse.json({ success: false, error: 'Ошибка регистрации профиля' }, { status: 500 })
        }
      }
    }

    if (!profileId || !tgId) {
      return NextResponse.json({ success: false, error: 'Missing or invalid authorization' }, { status: 401 })
    }

    const scores = calculateScores(answers)
    const primary = scores.dominantTrait.toUpperCase()
    const secondary = scores.secondaryTrait.toUpperCase()

    const { error: dbError } = await supabaseAdmin.rpc('save_test_result', {
      p_tg_id: tgId, p_primary_support: primary, p_secondary_support: secondary,
    })

    if (dbError) return NextResponse.json({ success: false, error: dbError.message }, { status: 500 })

    await supabaseAdmin.from('profiles').update({ current_step: null }).eq('id', profileId)

    triggerBotNotification({ event: 'dominant_trait_set', profile_id: profileId, tg_id: tgId, trait: primary })
      .catch(() => {})

    return NextResponse.json({ success: true, data: { dominantTrait: scores.dominantTrait, secondaryTrait: scores.secondaryTrait, scores } })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}