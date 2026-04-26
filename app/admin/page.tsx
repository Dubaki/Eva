'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import NextImage from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'

type AdminStats = {
  totalUsers: number
  completedTests: number
  traitCounts: Record<string, number>
  recentUsers: Array<{
    tg_id: number
    username: string | null
    created_at: string
    primary_support: string | null
    secondary_support: string | null
    invites_count: number
    last_test_date: string | null
    next_test_available: string | null
    contact_author_clicked: boolean
  }>
}

const TRAIT_LABELS: Record<string, string> = {
  S: 'Самоценность',
  U: 'Перфекционизм',
  P: 'Угодничество',
  R: 'Контроль',
  K: 'Сверхбдительность',
}

type Tab = 'stats' | 'crm' | 'broadcast'

export default function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('stats')
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())
  
  // CRM message modal
  const [msgModalOpen, setMsgModalOpen] = useState(false)
  const [msgTargetTgId, setMsgTargetTgId] = useState<number | null>(null)
  const [msgTargetUsername, setMsgTargetUsername] = useState<string>('')
  const [msgText, setMsgText] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgSent, setMsgSent] = useState(false)
  
  const router = useRouter()

  const adminHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem('admin_token')
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }, [])

  const refreshStats = useCallback(async () => {
    try {
      const headers = adminHeaders()
      const res = await fetch(`/api/admin/stats?t=${Date.now()}`, { headers, cache: 'no-store' })
      
      if (res.status === 401) {
        setUnauthorized(true)
        setLoading(false)
        return
      }
      
      const json = await res.json()
      if (json?.success) {
        setStats(json.data)
        setUnauthorized(false)
      } else {
        setUnauthorized(true)
      }
    } catch (err) {
      console.error('[admin] Fetch error:', err)
      setUnauthorized(true)
    } finally {
      setLoading(false)
    }
  }, [adminHeaders])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  const handleLogin = async () => {
    const pin = window.prompt('Введите PIN-код администратора')
    if (!pin) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (data.success && data.token) {
        localStorage.setItem('admin_token', data.token)
        refreshStats()
      } else {
        alert('❌ Неверный PIN-код')
        setLoading(false)
      }
    } catch (err) {
      alert('❌ Ошибка сети')
      setLoading(false)
    }
  }

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return
    setBroadcasting(true)
    try {
      const formData = new FormData()
      formData.append('message', broadcastMsg)
      if (selectedUsers.size > 0) {
        formData.append('target_tg_ids', JSON.stringify(Array.from(selectedUsers)))
      }
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: adminHeaders(),
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        setBroadcastResult(json.data)
        setBroadcastMsg('')
      }
    } catch (err) {
      alert('Ошибка при рассылке')
    } finally {
      setBroadcasting(false)
    }
  }

  const handleSendDirectMessage = async () => {
    if (!msgTargetTgId || !msgText.trim()) return
    setMsgSending(true)
    try {
      const res = await fetch('/api/admin/message/user', {
        method: 'POST',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_tg_id: msgTargetTgId, text: msgText }),
      })
      const json = await res.json()
      if (json.success) {
        setMsgSent(true)
        setTimeout(() => {
          setMsgModalOpen(false)
          setMsgSent(false)
          setMsgText('')
        }, 2000)
      }
    } catch (err) {
      alert('Ошибка отправки')
    } finally {
      setMsgSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f141a] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-2 border-[#8BA88E] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#8BA88E] font-medium animate-pulse">Загрузка системы...</p>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-[#0f141a] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-[#8BA88E]/10 rounded-full flex items-center justify-center mb-6 border border-[#8BA88E]/20 shadow-lg shadow-[#8BA88E]/5">
          <span className="material-symbols-outlined text-[#8BA88E] text-4xl">lock</span>
        </div>
        <h1 className="font-['Newsreader'] italic text-[32px] text-[#dee2ec] mb-2">Админ-панель</h1>
        <p className="text-[#dee2ec]/60 mb-8 max-w-xs">Доступ только для авторизованных пользователей</p>
        <button
          onClick={handleLogin}
          className="w-full max-w-xs py-4 bg-[#8BA88E] text-[#1c3622] font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-[#8BA88E]/10"
        >
          Войти по PIN-коду
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f141a] text-[#dee2ec] font-body-md">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0f141a]/80 backdrop-blur-xl border-b border-white/5 px-6 h-16 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#8BA88E] rounded-lg flex items-center justify-center text-[#1c3622] font-bold">E</div>
          <h1 className="font-['Newsreader'] italic text-xl">EvaAdmin</h1>
        </div>
        <button 
          onClick={() => { localStorage.removeItem('admin_token'); setUnauthorized(true); }}
          className="text-[#dee2ec]/40 hover:text-red-400 transition-colors"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </header>

      <main className="p-6 pb-32 max-w-5xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <nav className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
          {[
            { id: 'stats', label: 'Статистика', icon: 'query_stats' },
            { id: 'crm', label: 'Пользователи', icon: 'group' },
            { id: 'broadcast', label: 'Рассылка', icon: 'campaign' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#8BA88E] text-[#1c3622] shadow-lg shadow-[#8BA88E]/10' 
                  : 'text-[#dee2ec]/60 hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* ════════════ STATS TAB ════════════ */}
        {activeTab === 'stats' && stats && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <p className="text-[#dee2ec]/40 text-xs uppercase font-bold tracking-wider mb-1">Всего пользователей</p>
                <p className="text-3xl font-['Newsreader'] italic text-[#8BA88E]">{stats.totalUsers}</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <p className="text-[#dee2ec]/40 text-xs uppercase font-bold tracking-wider mb-1">Пройдено тестов</p>
                <p className="text-3xl font-['Newsreader'] italic text-[#8BA88E]">{stats.completedTests}</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#dee2ec]/60">Распределение опор</h3>
              <div className="space-y-3">
                {Object.entries(TRAIT_LABELS).map(([key, label]) => {
                  const count = stats.traitCounts[key] || 0
                  const percent = stats.completedTests > 0 ? (count / stats.completedTests) * 100 : 0
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-[#dee2ec]/80">{label} ({key})</span>
                        <span className="text-[#8BA88E] font-bold">{count} ({Math.round(percent)}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${percent}%` }} 
                          className="h-full bg-[#8BA88E] shadow-[0_0_8px_rgba(139,168,142,0.4)]"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ════════════ CRM TAB ════════════ */}
        {activeTab === 'crm' && stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="p-4 font-bold text-[#dee2ec]/40 text-[10px] uppercase tracking-wider">Пользователь</th>
                    <th className="p-4 font-bold text-[#dee2ec]/40 text-[10px] uppercase tracking-wider text-center">Опора</th>
                    <th className="p-4 font-bold text-[#dee2ec]/40 text-[10px] uppercase tracking-wider text-center">Друзья</th>
                    <th className="p-4 font-bold text-[#dee2ec]/40 text-[10px] uppercase tracking-wider text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {stats.recentUsers.map(user => (
                    <tr key={user.tg_id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#dee2ec]">{user.username || 'Без ника'}</span>
                          <span className="text-[10px] text-[#dee2ec]/30">{new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {user.primary_support ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#8BA88E]/10 border border-[#8BA88E]/20 text-[#8BA88E] font-bold text-[10px]">
                            {user.primary_support}
                            {user.secondary_support && <span className="text-[#dee2ec]/30">• {user.secondary_support}</span>}
                          </div>
                        ) : (
                          <span className="text-[#dee2ec]/20">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center font-bold text-[#8BA88E]">{user.invites_count}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {user.contact_author_clicked && (
                            <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" title="Запросил связь" />
                          )}
                          <button
                            onClick={() => {
                              setMsgTargetTgId(user.tg_id)
                              setMsgTargetUsername(user.username || String(user.tg_id))
                              setMsgModalOpen(true)
                            }}
                            className="p-2 rounded-xl bg-white/5 text-[#8BA88E] hover:bg-[#8BA88E] hover:text-[#1c3622] transition-all"
                          >
                            <span className="material-symbols-outlined text-[18px]">mail</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ════════════ BROADCAST TAB ════════════ */}
        {activeTab === 'broadcast' && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-6">
              <div className="text-center space-y-1">
                <h3 className="font-['Newsreader'] italic text-2xl text-[#dee2ec]">Массовая рассылка</h3>
                <p className="text-xs text-[#dee2ec]/40 uppercase tracking-widest font-bold">
                  {selectedUsers.size > 0 ? `Выбрано ${selectedUsers.size} получателей` : 'Будет отправлено всем пользователям'}
                </p>
              </div>

              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Текст сообщения (поддерживается HTML)..."
                rows={6}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-[#dee2ec] focus:border-[#8BA88E] focus:ring-1 focus:ring-[#8BA88E]/20 transition-all outline-none resize-none placeholder:text-white/10"
              />

              <button
                onClick={handleBroadcast}
                disabled={broadcasting || !broadcastMsg.trim()}
                className="w-full py-4 bg-[#8BA88E] text-[#1c3622] font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-[#8BA88E]/10 disabled:opacity-50"
              >
                {broadcasting ? '⏳ Отправка...' : '📢 Запустить рассылку'}
              </button>

              {broadcastResult && (
                <div className="p-4 bg-[#8BA88E]/5 border border-[#8BA88E]/20 rounded-xl text-center animate-bounce-in">
                  <p className="text-sm font-bold text-[#8BA88E]">✅ Рассылка завершена</p>
                  <p className="text-[10px] text-[#dee2ec]/40">Успешно: {broadcastResult.sent} | Ошибок: {broadcastResult.failed}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>

      {/* MODAL: Direct Message */}
      <AnimatePresence>
        {msgModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0f141a]/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#1c2229] border border-white/10 rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <h3 className="font-['Newsreader'] italic text-2xl">Написать @{msgTargetUsername}</h3>
                  <p className="text-[10px] text-[#dee2ec]/40 uppercase tracking-widest font-bold">Личное сообщение</p>
                </div>
                <button onClick={() => setMsgModalOpen(false)} className="p-2 text-white/20 hover:text-white transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {msgSent ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-[#8BA88E] rounded-full flex items-center justify-center mx-auto shadow-lg shadow-[#8BA88E]/20">
                    <span className="material-symbols-outlined text-[#1c3622] text-3xl font-bold">check</span>
                  </div>
                  <p className="text-[#8BA88E] font-bold">Сообщение отправлено!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <textarea
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Введите текст..."
                    rows={4}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm outline-none focus:border-[#8BA88E] transition-all"
                  />
                  <button
                    onClick={handleSendDirectMessage}
                    disabled={msgSending || !msgText.trim()}
                    className="w-full py-4 bg-[#8BA88E] text-[#1c3622] font-bold rounded-2xl active:scale-95 transition-all shadow-lg"
                  >
                    {msgSending ? '⏳ Отправка...' : 'Отправить'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Back Button */}
      <div className="fixed bottom-6 left-6 right-6 z-40 max-w-5xl mx-auto">
        <button
          onClick={() => router.push('/result')}
          className="w-full py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-[#dee2ec]/60 font-bold hover:bg-white/10 active:scale-95 transition-all"
        >
          🔙 Назад в приложение
        </button>
      </div>
    </div>
  )
}
