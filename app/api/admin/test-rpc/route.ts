import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'

/**
 * Тестовый эндпоинт для прямой проверки RPC save_test_result.
 * Вызов: POST /api/admin/test-rpc
 * Body: { tg_id: number, primary: string, secondary: string }
 * 
 * Защищен Admin JWT.
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const tgId = body?.tg_id
    const primary = body?.primary ?? 'S'
    const secondary = body?.secondary ?? 'U'

    if (!tgId || typeof tgId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid tg_id (must be number)' },
        { status: 400 }
      )
    }

    console.log('[test-rpc] Testing RPC with:', { tgId, primary, secondary })

    const supabase = getSupabaseServer()

    // Step 1: Check if profile exists
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, tg_id')
      .eq('tg_id', tgId)
      .maybeSingle()

    console.log('[test-rpc] Profile lookup:', { profileFound: !!profile, profileErr })

    if (!profile) {
      console.log('[test-rpc] Profile not found, creating one for test...')
      const { data: newProfile, error: createErr } = await supabase
        .from('profiles')
        .insert({
          tg_id: tgId,
          username: 'test_user_rpc',
        })
        .select('id, tg_id')
        .maybeSingle()

      if (createErr) {
        console.error('[test-rpc] Failed to create test profile:', createErr)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to create test profile',
            details: createErr,
            step: 'create_profile',
          },
          { status: 500 }
        )
      }

      console.log('[test-rpc] Test profile created:', newProfile)
    }

    // Step 2: Call RPC
    const { error: rpcError, data: rpcData } = await supabase.rpc('save_test_result', {
      p_tg_id: tgId,
      p_primary_support: primary,
      p_secondary_support: secondary,
    })

    console.log('[test-rpc] RPC result:', { rpcError, rpcData })

    if (rpcError) {
      return NextResponse.json(
        {
          success: false,
          error: rpcError.message,
          details: rpcError,
          step: 'rpc_call',
          params: { p_tg_id: tgId, p_primary_support: primary, p_secondary_support: secondary },
        },
        { status: 500 }
      )
    }

    // Step 3: Verify data was saved
    const { data: result } = await supabase
      .from('test_results')
      .select('tg_id, primary_support, secondary_support')
      .eq('tg_id', tgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      message: 'RPC call succeeded',
      rpcParams: { p_tg_id: tgId, p_primary_support: primary, p_secondary_support: secondary },
      savedResult: result,
    })
  } catch (err) {
    console.error('[test-rpc] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}
