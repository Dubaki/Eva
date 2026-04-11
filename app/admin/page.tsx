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
    contact_author_clicked: boolean
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

/**
 * Compress an image file client-side using Canvas API.
 * Target: ~500KB. Max dimension: 1920px. Quality: 0.7.
 */
async function compressImage(file: File, maxSizeKB = 500): Promise<Blob> {
  const MAX_DIM = 1920
  const quality = 0.7

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height / width) * MAX_DIM)
            width = MAX_DIM
          } else {
            width = Math.round((width / height) * MAX_DIM)
            height = MAX_DIM
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else resolve(file) // fallback to original
          },
          'image/jpeg',
          quality
        )
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
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
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())
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
    fetch('/api/admin/stats', { headers, cache: 'no-store' })
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
    fetch('/api/admin/gifts', { headers, cache: 'no-store' })
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
      if (selectedUsers.size > 0) {
        formData.append('target_tg_ids', JSON.stringify(Array.from(selectedUsers)))
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
        setSelectedUsers(new Set())
      }
    } catch (err) {
      console.error('[admin] Broadcast error:', err)
    } finally {
      setBroadcasting(false)
    }
  }

  const toggleUserSelection = (tgId: number) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(tgId)) next.delete(tgId)
      else next.add(tgId)
      return next
    })
  }

  const toggleAllUsers = () => {
    if (!stats) return
    const allIds = stats.recentUsers.map((u) => u.tg_id)
    const allSelected = allIds.every((id) => selectedUsers.has(id))
    setSelectedUsers(allSelected ? new Set() : new Set(allIds))
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      let processedFile: File = file
      // Compress if > 5MB
      if (file.size > 5 * 1024 * 1024) {
        console.log(`[admin] Compressing image: ${(file.size / 1024 / 1024).toFixed(1)}MB`)
        const blob = await compressImage(file)
        processedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
        console.log(`[admin] Compressed to: ${(processedFile.size / 1024 / 1024).toFixed(1)}MB`)
      }
      setBroadcastPhoto(processedFile)
      const reader = new FileReader()
      reader.onload = () => setBroadcastPhotoPreview(reader.result as string)
      reader.readAsDataURL(processedFile)
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
    <main className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0 px-4 pt-4 pb-3 max-w-lg mx-auto w-full gap-3">

        {/* Header — Glass */}
        <div className="bg-white/70 backdrop-blur-md border border-white/30 shadow-lg rounded-2xl px-5 py-3 text-center shrink-0">
          <h1 className="text-[22px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            👑 Админ-панель
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Статистика проекта EVA</p>
        </div>

        {/* Tabs — pill bar */}
        <div className="bg-white/60 backdrop-blur-md border border-white/20 shadow-md rounded-2xl p-1.5 flex gap-1 shrink-0">
          {([
            ['stats', '📊 Статистика'],
            ['crm', '👥 CRM'],
            ['broadcast', '📢 Рассылка'],
            ['gifts', '🎁 Подарки'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setActiveTab(key); setBroadcastResult(null) }}
              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all duration-300 ${
                activeTab === key
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ════════════ SCROLLABLE CONTENT AREA ════════════ */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">

        {/* ════════════ STATS TAB ════════════ */}
        {activeTab === 'stats' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white/70 backdrop-blur-md border border-white/30 shadow-xl rounded-2xl p-5 text-center hover:shadow-2xl transition-all duration-300"
              >
                <p className="text-gray-400 text-[11px] uppercase tracking-widest mb-2 font-medium">Всего пользователей</p>
                <p className="text-[32px] font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{stats.totalUsers}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/70 backdrop-blur-md border border-white/30 shadow-xl rounded-2xl p-5 text-center hover:shadow-2xl transition-all duration-300"
              >
                <p className="text-gray-400 text-[11px] uppercase tracking-widest mb-2 font-medium">Прошли тест</p>
                <p className="text-[32px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{stats.completedTests}</p>
              </motion.div>
            </div>
          </>
        )}

        {/* ════════════ CRM TAB ════════════ */}
        {activeTab === 'crm' && (
          <div className="flex flex-col gap-3">
            {/* All users table */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-gray-500 text-xs uppercase tracking-widest font-medium">👥 Все пользователи</p>
                <div className="flex gap-1.5">
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
                        className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {labels[field]} {isActive && (sortDir === 'asc' ? '↑' : '↓')}
                      </button>
                    )
                  })}
                </div>
              </div>

              {stats.recentUsers.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Пока нет пользователей</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-center py-2.5 px-1 text-gray-400 font-medium w-8">
                          <input
                            type="checkbox"
                            checked={stats.recentUsers.every((u) => selectedUsers.has(u.tg_id))}
                            onChange={toggleAllUsers}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </th>
                        <th className="text-left py-2.5 px-2 text-gray-400 font-medium">Username</th>
                        <th className="text-left py-2.5 px-2 text-gray-400 font-medium">Опора</th>
                        <th className="text-center py-2.5 px-2 text-gray-400 font-medium">🔗</th>
                        <th className="text-center py-2.5 px-2 text-gray-400 font-medium">Тест</th>
                        <th className="text-center py-2.5 px-2 text-gray-400 font-medium">✉️</th>
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
                        .map((u, i) => (
                            <tr key={i} className={`border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors ${
                              selectedUsers.has(u.tg_id) ? 'bg-blue-50/60' : ''
                            }`}>
                              <td className="py-2.5 px-1 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedUsers.has(u.tg_id)}
                                  onChange={() => toggleUserSelection(u.tg_id)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-2">
                                <div className="flex flex-col gap-0.5">
                                  <p className="font-medium text-gray-700 truncate max-w-[120px]">
                                    {u.username ? (
                                      <a
                                        href={`https://t.me/${u.username}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                      >
                                        @{u.username}
                                      </a>
                                    ) : (
                                      <span className="text-gray-400 text-[11px]">{u.tg_id}</span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    {new Date(u.created_at).toLocaleDateString('ru-RU')}
                                  </p>
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                {u.dominantTrait ? (
                                  <span className="text-blue-600 font-medium text-[11px]">{TRAIT_LABELS[u.dominantTrait] ?? u.dominantTrait}</span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <span className="font-medium text-gray-600">{u.invites_count ?? 0}</span>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                {u.last_test_date ? (
                                  <span className="text-gray-400 text-[11px]">
                                    {new Date(u.last_test_date).toLocaleDateString('ru-RU')}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">нет</span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openMessageModal(u.tg_id, u.username)}
                                    className="text-[11px] px-2 py-1 rounded-md bg-gray-50 text-gray-500 hover:bg-blue-500 hover:text-white transition-all font-medium"
                                  >
                                    ✉️
                                  </button>
                                  {u.contact_author_clicked && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[9px] font-semibold leading-none">
                                      🔥 Запросил
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        )}
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
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="text-center mb-4">
              <p className="text-gray-400 text-xs uppercase tracking-widest font-medium">
                {selectedUsers.size > 0
                  ? `Рассылка выбранным (${selectedUsers.size})`
                  : 'Рассылка всем пользователям'}
              </p>
              {selectedUsers.size > 0 && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('crm') }}
                  className="text-[11px] text-blue-500 hover:text-blue-700 mt-1 font-medium"
                >
                  ← Выбрать в CRM
                </button>
              )}
            </div>

            {/* Photo upload */}
            <div className="mb-3">
              <label className="text-[12px] font-medium text-gray-600 mb-2 block">📷 Фото (необязательно)</label>
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center justify-center py-6 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all">
                  {broadcastPhotoPreview ? (
                    <img src={broadcastPhotoPreview} alt="Preview" className="max-h-28 rounded-lg object-cover" />
                  ) : (
                    <div className="text-center">
                      <p className="text-2xl mb-1">🖼️</p>
                      <p className="text-gray-400 text-[12px]">Нажмите для загрузки</p>
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
                    className="text-gray-400 hover:text-red-500 transition-colors text-xl shrink-0"
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
              rows={4}
              className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none mb-3"
            />

            <motion.button
              type="button"
              whileTap={{ scale: broadcasting ? 1 : 0.97 }}
              onClick={handleBroadcast}
              disabled={broadcasting || (!broadcastMsg.trim() && !broadcastPhoto)}
              className={`w-full py-3 rounded-xl font-semibold text-[14px] text-white transition-all shadow-md ${
                broadcasting || (!broadcastMsg.trim() && !broadcastPhoto)
                  ? 'opacity-60 cursor-not-allowed shadow-none'
                  : 'active:scale-[0.98] hover:shadow-lg'
              }`}
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
            >
              {broadcasting ? '⏳ Отправка...' : '📢 Сделать рассылку'}
            </motion.button>

            {broadcastResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100 text-center"
              >
                <p className="text-gray-800 text-[13px] font-semibold">
                  ✅ Рассылка завершена
                </p>
                <div className="flex items-center justify-center gap-3 mt-1.5">
                  <span className="text-emerald-600 text-[12px] font-medium">
                    Доставлено: {broadcastResult.sent}
                  </span>
                  {broadcastResult.failed > 0 && (
                    <span className="text-red-500 text-[12px] font-medium">
                      Ошибок: {broadcastResult.failed}
                    </span>
                  )}
                  <span className="text-gray-400 text-[12px]">
                    Всего: {broadcastResult.total}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ════════════ GIFTS TAB ════════════ */}
        {activeTab === 'gifts' && (
          <div className="flex flex-col gap-3">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-gray-400 text-xs uppercase tracking-widest mb-3 text-center font-medium">
                Ссылки на подарки по сферам
              </p>

              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="text-[12px] font-medium text-gray-600 mb-1 block">💰 Деньги</label>
                  <input
                    type="text"
                    value={giftLinks.gift_money}
                    onChange={(e) => setGiftLinks({ ...giftLinks, gift_money: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-medium text-gray-600 mb-1 block">❤️ Отношения</label>
                  <input
                    type="text"
                    value={giftLinks.gift_relations}
                    onChange={(e) => setGiftLinks({ ...giftLinks, gift_relations: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-medium text-gray-600 mb-1 block">🌿 Здоровье</label>
                  <input
                    type="text"
                    value={giftLinks.gift_health}
                    onChange={(e) => setGiftLinks({ ...giftLinks, gift_health: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-medium text-gray-600 mb-1 block">📦 Другое</label>
                  <input
                    type="text"
                    value={giftLinks.gift_other}
                    onChange={(e) => setGiftLinks({ ...giftLinks, gift_other: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                </div>
              </div>

              <div className="mt-4">
                <motion.button
                  type="button"
                  whileTap={{ scale: saving ? 1 : 0.97 }}
                  onClick={handleSaveGifts}
                  disabled={saving}
                  className={`w-full py-2.5 rounded-xl font-semibold text-[14px] text-white transition-all ${
                    saving ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.98]'
                  }`}
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                >
                  {saving ? 'Сохранение...' : saved ? '✅ Сохранено!' : '💾 Сохранить'}
                </motion.button>
              </div>
            </div>
          </div>
        )}
        </div>{/* end scrollable content area */}

        {/* Back button — outside scrollable area */}
        <a
          href="/result"
          className="block w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold text-[14px] text-center active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20 shrink-0"
        >
          🔙 Назад в приложение
        </a>
      </div>
    </main>
  )
}
