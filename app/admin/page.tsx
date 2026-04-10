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
    invites_count: number
    last_test_date: string | null
    next_test_available: string | null
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

type Tab = 'stats' | 'crm' | 'broadcast' | 'gifts'
type SortField = 'created_at' | 'invites_count' | 'last_test_date'
type SortDir = 'asc' | 'desc'

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
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcastPhoto, setBroadcastPhoto] = useState<File | null>(null)
  const [broadcastPhotoPreview, setBroadcastPhotoPreview] = useState<string | null>(null)
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  // CRM direct message modal
  const [msgModalOpen, setMsgModalOpen] = useState(false)
  const [msgTargetTgId, setMsgTargetTgId] = useState<number | null>(null)
  const [msgTargetUsername, setMsgTargetUsername] = useState<string>('')
  const [msgText, setMsgText] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgSent, setMsgSent] = useState(false)
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

    // If authorized via PIN but no token, still proceed — PIN is sufficient
    const token = localStorage.getItem('eva_token')
    const headers = adminHeaders()

    // Fetch stats (PIN alone is sufficient for access)
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
    fetch('/api/admin/gifts', { headers })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setGiftLinks(json.data)
        }
      })
      .catch((err) => console.error('[admin] Gifts fetch error:', err))
  }, [])

  const handleSaveGifts = async () => {
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

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim() && !broadcastPhoto) return

    setBroadcasting(true)
    setBroadcastResult(null)
    try {
      const formData = new FormData()
      formData.append('message', broadcastMsg)
      if (broadcastPhoto) {
        formData.append('photo', broadcastPhoto)
      }

      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          ...adminHeaders(),
          'X-Admin-Pin': '2026',
        },
        body: formData,
      })
      const json = await res.json()
      if (json.success && json.data) {
        setBroadcastResult({ sent: json.data.sent, failed: json.data.failed, total: json.data.total })
        setBroadcastMsg('')
        setBroadcastPhoto(null)
        setBroadcastPhotoPreview(null)
      }
    } catch (err) {
      console.error('[admin] Broadcast error:', err)
    } finally {
      setBroadcasting(false)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBroadcastPhoto(file)
      const reader = new FileReader()
      reader.onload = () => setBroadcastPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const openMessageModal = (tgId: number, username: string | null) => {
    setMsgTargetTgId(tgId)
    setMsgTargetUsername(username ?? `ID: ${tgId}`)
    setMsgText('')
    setMsgSent(false)
    setMsgModalOpen(true)
  }

  const handleSendDirectMessage = async () => {
    if (!msgTargetTgId || !msgText.trim()) return
    setMsgSending(true)
    setMsgSent(false)
    try {
      const res = await fetch('/api/admin/message/user', {
        method: 'POST',
        headers: {
          ...adminHeaders(),
          'Content-Type': 'application/json',
          'X-Admin-Pin': '2026',
        },
        body: JSON.stringify({ target_tg_id: msgTargetTgId, text: msgText }),
      })
      const json = await res.json()
      if (json.success) {
        setMsgSent(true)
        setTimeout(() => {
          setMsgModalOpen(false)
          setMsgSent(false)
        }, 2000)
      }
    } catch (err) {
      console.error('[admin] Direct message error:', err)
    } finally {
      setMsgSending(false)
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
            onClick={() => { setActiveTab('crm'); setBroadcastResult(null) }}
            className={`flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-colors ${
              activeTab === 'crm'
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-muted border border-border hover:text-accent'
            }`}
          >
            👥 CRM
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            className={`flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-colors ${
              activeTab === 'broadcast'
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-muted border border-border hover:text-accent'
            }`}
          >
            📢 Рассылка
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('gifts'); setBroadcastResult(null) }}
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
                Последние 50 пользователей
              </p>
              {stats.recentUsers.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-4">Пока нет пользователей</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {stats.recentUsers.slice(0, 20).map((u, i) => (
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

        {/* ════════════ CRM TAB ════════════ */}
        {activeTab === 'crm' && (
          <div className="flex flex-col gap-5">
            {/* Top Referrers */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-gray-500 text-xs uppercase tracking-widest font-medium">🏆 Топ рефереры</p>
              </div>

              {stats.recentUsers.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Пока нет пользователей</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-gray-400 font-medium">#</th>
                        <th className="text-left py-3 px-3 text-gray-400 font-medium">Username</th>
                        <th className="text-center py-3 px-3 text-gray-400 font-medium">TG ID</th>
                        <th className="text-center py-3 px-3 text-gray-400 font-medium">🔗 Реф.</th>
                        <th className="text-center py-3 px-3 text-gray-400 font-medium">✉️</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...stats.recentUsers]
                        .sort((a, b) => (b.invites_count ?? 0) - (a.invites_count ?? 0))
                        .filter((u) => (u.invites_count ?? 0) > 0)
                        .map((u, i) => (
                          <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                            <td className="py-2.5 px-3 text-gray-400">{i + 1}</td>
                            <td className="py-2.5 px-3">
                              {u.username ? (
                                <a
                                  href={`https://t.me/${u.username}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-accent font-medium hover:underline"
                                >
                                  @{u.username}
                                </a>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-gray-500 font-mono text-[12px]">
                              {u.tg_id}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 text-accent font-semibold text-[13px]">
                                {u.invites_count ?? 0}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => openMessageModal(u.tg_id, u.username)}
                                className="text-[12px] px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-accent hover:text-white transition-all font-medium"
                              >
                                Написать
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* All users table (existing) */}
            <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <p className="text-text-muted text-xs uppercase tracking-widest">Все пользователи</p>
                <div className="flex gap-2">
                  {(['created_at', 'invites_count', 'last_test_date'] as SortField[]).map((field) => {
                    const labels: Record<SortField, string> = {
                      created_at: '📅 Дата',
                      invites_count: '🔗 Реф.',
                      last_test_date: '🧪 Тест',
                    }
                    const isActive = sortField === field
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => {
                          if (sortField === field) {
                            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField(field)
                            setSortDir('desc')
                          }
                        }}
                        className={`text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-accent text-white'
                            : 'bg-bg-primary text-text-muted border border-border hover:text-accent'
                        }`}
                      >
                        {labels[field]} {isActive && (sortDir === 'asc' ? '↑' : '↓')}
                      </button>
                    )
                  })}
                </div>
              </div>

              {stats.recentUsers.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">Пока нет пользователей</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-3 text-text-muted font-medium">Пользователь</th>
                        <th className="text-left py-3 px-3 text-text-muted font-medium">Опора</th>
                        <th className="text-center py-3 px-3 text-text-muted font-medium">🔗</th>
                        <th className="text-center py-3 px-3 text-text-muted font-medium">Тест</th>
                        <th className="text-center py-3 px-3 text-text-muted font-medium">✉️</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...stats.recentUsers]
                        .sort((a, b) => {
                          const mul = sortDir === 'asc' ? 1 : -1
                          if (sortField === 'invites_count') {
                            return mul * ((a.invites_count ?? 0) - (b.invites_count ?? 0))
                          }
                          if (sortField === 'last_test_date') {
                            const da = a.last_test_date || '1970-01-01'
                            const db2 = b.last_test_date || '1970-01-01'
                            return mul * (da < db2 ? -1 : da > db2 ? 1 : 0)
                          }
                          return mul * (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)
                        })
                        .map((u, i) => {
                          const daysUntilTest = u.next_test_available
                            ? Math.ceil((new Date(u.next_test_available).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                            : null
                          return (
                            <tr key={i} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary transition-colors">
                              <td className="py-2.5 px-3">
                                <p className="font-medium text-text-primary truncate max-w-[140px]">
                                  {u.username ? `@${u.username}` : `${u.tg_id}`}
                                </p>
                                <p className="text-[10px] text-text-muted">
                                  {new Date(u.created_at).toLocaleDateString('ru-RU')}
                                </p>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {u.dominantTrait ? (
                                  <span className="text-accent font-medium">{TRAIT_LABELS[u.dominantTrait] ?? u.dominantTrait}</span>
                                ) : (
                                  <span className="text-text-muted">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="font-medium text-text-primary">{u.invites_count ?? 0}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {u.last_test_date ? (
                                  <span className="text-text-muted text-[11px]">
                                    {new Date(u.last_test_date).toLocaleDateString('ru-RU')}
                                  </span>
                                ) : (
                                  <span className="text-text-muted text-[11px]">нет</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => openMessageModal(u.tg_id, u.username)}
                                  className="text-[11px] px-2.5 py-1 rounded-md bg-bg-primary text-text-muted border border-border hover:border-accent hover:text-accent transition-all"
                                >
                                  Написать
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Direct Message Modal */}
            {msgModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[17px] font-semibold text-gray-800">
                      💬 Написать @{msgTargetUsername}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setMsgModalOpen(false)}
                      className="text-gray-400 hover:text-gray-600 text-xl transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  {msgSent ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-6"
                    >
                      <p className="text-3xl mb-2">✅</p>
                      <p className="text-gray-700 font-medium">Сообщение отправлено!</p>
                    </motion.div>
                  ) : (
                    <>
                      <textarea
                        value={msgText}
                        onChange={(e) => setMsgText(e.target.value)}
                        placeholder="Введите сообщение (поддерживается HTML)..."
                        rows={4}
                        className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none mb-4"
                      />
                      <motion.button
                        type="button"
                        whileTap={{ scale: msgSending ? 1 : 0.97 }}
                        onClick={handleSendDirectMessage}
                        disabled={msgSending || !msgText.trim()}
                        className={`w-full py-3 rounded-xl font-semibold text-[15px] text-white transition-all shadow-md ${
                          msgSending || !msgText.trim()
                            ? 'opacity-60 cursor-not-allowed shadow-none'
                            : 'active:scale-[0.98] hover:shadow-lg'
                        }`}
                        style={{ background: 'var(--accent)' }}
                      >
                        {msgSending ? '⏳ Отправка...' : '📤 Отправить'}
                      </motion.button>
                    </>
                  )}
                </motion.div>
              </div>
            )}
          </div>
        )}

        {/* ════════════ BROADCAST TAB ════════════ */}
        {activeTab === 'broadcast' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-5 text-center font-medium">
              Рассылка всем пользователям
            </p>

            {/* Photo upload */}
            <div className="mb-4">
              <label className="text-[13px] font-medium text-gray-600 mb-2 block">📷 Фото (необязательно)</label>
              <div className="flex items-center gap-4">
                <label className="flex-1 flex items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-accent hover:bg-accent/5 transition-all">
                  {broadcastPhotoPreview ? (
                    <img src={broadcastPhotoPreview} alt="Preview" className="max-h-32 rounded-lg object-cover" />
                  ) : (
                    <div className="text-center">
                      <p className="text-2xl mb-1">🖼️</p>
                      <p className="text-gray-400 text-[13px]">Нажмите для загрузки фото</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
                {broadcastPhoto && (
                  <button
                    type="button"
                    onClick={() => { setBroadcastPhoto(null); setBroadcastPhotoPreview(null) }}
                    className="text-gray-400 hover:text-red-500 transition-colors text-xl"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Введите текст рассылки (поддерживается HTML)..."
              rows={5}
              className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none mb-4"
            />

            <motion.button
              type="button"
              whileTap={{ scale: broadcasting ? 1 : 0.97 }}
              onClick={handleBroadcast}
              disabled={broadcasting || (!broadcastMsg.trim() && !broadcastPhoto)}
              className={`w-full py-3.5 rounded-xl font-semibold text-[15px] text-white transition-all shadow-md ${
                broadcasting || (!broadcastMsg.trim() && !broadcastPhoto)
                  ? 'opacity-60 cursor-not-allowed shadow-none'
                  : 'active:scale-[0.98] hover:shadow-lg'
              }`}
              style={{ background: 'var(--accent)' }}
            >
              {broadcasting ? '⏳ Отправка...' : '📢 Сделать рассылку всем пользователям'}
            </motion.button>

            {broadcastResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center"
              >
                <p className="text-gray-800 text-[15px] font-semibold">
                  ✅ Рассылка завершена
                </p>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <span className="text-emerald-600 text-[13px] font-medium">
                    Доставлено: {broadcastResult.sent}
                  </span>
                  {broadcastResult.failed > 0 && (
                    <span className="text-red-500 text-[13px] font-medium">
                      Ошибок: {broadcastResult.failed}
                    </span>
                  )}
                  <span className="text-gray-400 text-[13px]">
                    Всего: {broadcastResult.total}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
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
