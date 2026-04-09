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

const TRAIT_LABELS: Record<string, string> = {
  S: 'Самоценность',
  U: 'Перфекционизм',
  P: 'Угодничество',
  R: 'Контроль',
  K: 'Сверхбдительность',
}

export default function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check authorization
    const profileRaw = localStorage.getItem('eva_profile')
    let authorized = false
    if (profileRaw) {
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

    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
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
  }, [])

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
