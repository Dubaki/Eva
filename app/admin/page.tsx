'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

const TESTER_IDS = ['1149371967', '5930269100', '1419397753']

type AdminStats = {
  totalUsers: number
  completedTests: number
  traitCounts: Record<string, number>
  recentUsers: Array<{
    tg_id: number
    username: string | null
    created_at: string
    dominantTrait: string | null
    secondaryTrait: string | null
  }>
}

type GiftLinks = {
  gift_money: string
  gift_relations: string
  gift_health: string
  gift_other: string
}

const TRAIT_LABELS: Record<string, string> = {
  S: 'Самоценность',
  U: 'Перфекционизм',
  P: 'Угодничество',
  R: 'Контроль',
  K: 'Сверхбдительность',
}

type Tab = 'stats' | 'gifts'

export default function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('stats')
  const [giftLinks, setGiftLinks] = useState<GiftLinks>({
    gift_money: '',
    gift_relations: '',
    gift_health: '',
    gift_other: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  const adminHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('eva_token')
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (localStorage.getItem('isAdmin') === 'true') headers['X-Admin-Pin'] = '2026'
    return headers
  }

  useEffect(() => {
    // Check authorization: either TESTER_IDS or isAdmin from PIN
    const profileRaw = localStorage.getItem('eva_profile')
    const isAdminViaPin = localStorage.getItem('isAdmin') === 'true'
    let authorized = isAdminViaPin
    if (!authorized && profileRaw) {
      try {
        const p = JSON.parse(profileRaw) as { tg_id?: number }
        authorized = TESTER_IDS.includes(String(p.tg_id))
      } catch { /* ignore */ }
    }

    if (!authorized) {
      setUnauthorized(true)
      setLoading(false)
      return
    }

    const token = localStorage.getItem('eva_token')
    if (!token) {
      setLoading(false)
      return
    }

    const isAdminViaPinLocal = localStorage.getItem('isAdmin') === 'true'
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    if (isAdminViaPinLocal) headers['X-Admin-Pin'] = '2026'

    // Fetch stats
    fetch('/api/admin/stats', { headers })
      .then((r) => {
        if (!r.ok) {
          return r.json().then((json) => {
            console.error('[admin] API error:', r.status, json.error)
            if (json.error === 'Unauthorized') setUnauthorized(true)
            else setLoading(false)
          })
        }
        return r.json()
      })
      .then((json) => {
        if (json && json.success) {
          setStats(json.data)
        } else if (json && json.error) {
          console.error('[admin] Server returned error:', json.error)
        }
      })
      .catch((err) => console.error('[admin] Fetch error:', err))
      .finally(() => setLoading(false))

    // Fetch gift links
    fetch('/api/admin/gifts', { headers: adminHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setGiftLinks(json.data)
        }
      })
      .catch((err) => console.error('[admin] Gifts fetch error:', err))
  }, [])

  const handleSaveGifts = async () => {
    const token = localStorage.getItem('eva_token')
    if (!token) return

    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/admin/gifts', {
        method: 'POST',
        headers: {
          ...adminHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(giftLinks),
      })
      const json = await res.json()
      if (json.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error('[admin] Save gifts error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (unauthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-text-primary text-lg font-medium mb-2">Доступ ограничен</p>
          <p className="text-text-muted text-sm mb-4">Эта панель доступна только авторизованным тестировщикам.</p>
          <button
            onClick={() => router.push('/result')}
            className="inline-block py-3 px-6 bg-accent text-white rounded-xl font-semibold text-sm"
          >
            🔙 Назад в приложение
          </button>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary">
        <motion.div
          className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </main>
    )
  }

  if (!stats) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
        <div className="text-center">
          <p className="text-text-primary text-lg font-medium">Не удалось загрузить статистику</p>
          <a href="/result" className="inline-block mt-4 py-3 px-6 bg-accent text-white rounded-xl font-semibold text-sm">
            🔙 Назад в приложение
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-col min-h-screen bg-bg-primary">
      <div className="flex flex-col flex-1 px-5 pt-8 pb-8 max-w-lg mx-auto w-full gap-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-[24px] font-bold text-text-primary">👑 Админ-панель</h1>
          <p className="text-text-muted text-sm mt-1">Статистика проекта EVA</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-colors ${
              activeTab === 'stats'
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-muted border border-border hover:text-accent'
            }`}
          >
            📊 Статистика
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gifts')}
            className={`flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-colors ${
              activeTab === 'gifts'
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-muted border border-border hover:text-accent'
            }`}
          >
            🎁 Подарки
          </button>
        </div>

        {/* ════════════ STATS TAB ════════════ */}
        {activeTab === 'stats' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-secondary rounded-xl p-4 border border-border text-center">
                <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Всего пользователей</p>
                <p className="text-[28px] font-bold text-text-primary">{stats.totalUsers}</p>
              </div>
              <div className="bg-bg-secondary rounded-xl p-4 border border-border text-center">
                <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Прошли тест</p>
                <p className="text-[28px] font-bold text-accent">{stats.completedTests}</p>
              </div>
            </div>

            {/* Trait distribution */}
            <div className="bg-bg-secondary rounded-xl p-5 border border-border">
              <p className="text-text-muted text-xs uppercase tracking-widest mb-3 text-center">
                Распределение по опорам
              </p>
              <div className="flex flex-col gap-2">
                {Object.entries(TRAIT_LABELS).map(([key, label]) => {
                  const count = stats.traitCounts[key] ?? 0
                  const pct = stats.completedTests > 0 ? Math.round((count / stats.completedTests) * 100) : 0
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-[13px] font-medium text-text-primary w-[130px] text-right">
                        {label}
                      </span>
                      <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[12px] text-text-muted tabular-nums w-12">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent users */}
            <div className="bg-bg-secondary rounded-xl p-5 border border-border">
              <p className="text-text-muted text-xs uppercase tracking-widest mb-3 text-center">
                Последние 20 пользователей
              </p>
              {stats.recentUsers.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-4">Пока нет пользователей</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {stats.recentUsers.map((u, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate">
                          {u.username ? `@${u.username}` : `ID: ${u.tg_id}`}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          {new Date(u.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-[12px] text-accent font-medium">
                          {u.dominantTrait ? TRAIT_LABELS[u.dominantTrait] ?? u.dominantTrait : '—'}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {u.secondaryTrait ?? 'нет'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════ GIFTS TAB ════════════ */}
        {activeTab === 'gifts' && (
          <div className="flex flex-col gap-4">
            <div className="bg-bg-secondary rounded-xl p-5 border border-border">
              <p className="text-text-muted text-xs uppercase tracking-widest mb-4 text-center">
                Ссылки на подарки по сферам
              </p>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[13px] font-medium text-text-primary mb-1 block">💰 Деньги</label>
                  <input
                    type="text"
                    value={giftLinks.gift_money}
                    onChange={(e) => setGiftLinks({ ...giftLinks, gift_money: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full py-2.5 px-3 bg-bg-primary border border-border rounded-xl text-[14px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-medium text-text-primary mb-1 block">❤️ Отношения</label>
                  <input
                    type="text"
                    value={giftLinks.gift_relations}
                    onChange={(e) => setGiftLinks({ ...giftLinks, gift_relations: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full py-2.5 px-3 bg-bg-primary border border-border rounded-xl text-[14px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-medium text-text-primary mb-1 block">🌿 Здоровье</label>
                  <input
                    type="text"
                    value={giftLinks.gift_health}
                    onChange={(e) => setGiftLinks({ ...giftLinks, gift_health: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full py-2.5 px-3 bg-bg-primary border border-border rounded-xl text-[14px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-medium text-text-primary mb-1 block">📦 Другое</label>
                  <input
                    type="text"
                    value={giftLinks.gift_other}
                    onChange={(e) => setGiftLinks({ ...giftLinks, gift_other: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full py-2.5 px-3 bg-bg-primary border border-border rounded-xl text-[14px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="mt-5">
                <motion.button
                  type="button"
                  whileTap={{ scale: saving ? 1 : 0.97 }}
                  onClick={handleSaveGifts}
                  disabled={saving}
                  className={`w-full py-3 rounded-xl font-semibold text-[15px] text-white transition-all ${
                    saving ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.98]'
                  }`}
                  style={{ background: 'var(--accent)' }}
                >
                  {saving ? 'Сохранение...' : saved ? '✅ Сохранено!' : '💾 Сохранить ссылки'}
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {/* Back button */}
        <a
          href="/result"
          className="block w-full py-3 bg-accent text-white rounded-xl font-semibold text-[15px] text-center active:scale-[0.98] transition-transform"
        >
          🔙 Назад в приложение
        </a>
      </div>
    </main>
  )
}
