'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import NextImage from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'

type AdminStats = {
  totalUsers: number
  completedTests: number
  contactAuthorCount: number
  recentUsers: Array<{
    tg_id: number
    username: string | null
    created_at: string
    invites_count: number
    last_test_date: string | null
    contact_author_clicked: boolean
  }>
}

type Tab = 'stats' | 'crm' | 'broadcast'

export default function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('stats')
  
  // Broadcast
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcastPhoto, setBroadcastPhoto] = useState<File | null>(null)
  const [broadcastPhotoPreview, setBroadcastPhotoPreview] = useState<string | null>(null)
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())
  
  // CRM Message
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
    if (!broadcastMsg.trim() && !broadcastPhoto) return
    setBroadcasting(true)
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
        headers: adminHeaders(),
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        setBroadcastResult(json.data)
        setBroadcastMsg('')
        setBroadcastPhoto(null)
        setBroadcastPhotoPreview(null)
        setSelectedUsers(new Set())
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

  const toggleUserSelection = (tgId: number) => {
    const next = new Set(selectedUsers)
    if (next.has(tgId)) next.delete(tgId)
    else next.add(tgId)
    setSelectedUsers(next)
  }

  const toggleAllUsers = () => {
    if (!stats) return
    if (selectedUsers.size === stats.recentUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(stats.recentUsers.map(u => u.tg_id)))
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBroadcastPhoto(file)
      setBroadcastPhotoPreview(URL.createObjectURL(file))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f141a] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-2 border-[#8BA88E] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#8BA88E] font-medium">Загрузка...</p>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-[#0f141a] flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-20 h-20 bg-[#8BA88E]/20 rounded-full flex items-center justify-center mb-6 border border-[#8BA88E]/40">
          <span className="material-symbols-outlined text-[#8BA88E] text-4xl">lock</span>
        </div>
        <h1 className="text-3xl font-bold mb-8">Admin Access</h1>
        <button
          onClick={handleLogin}
          className="w-full max-w-xs py-4 bg-[#8BA88E] text-white font-bold rounded-2xl active:scale-95 transition-all"
        >
          Войти по PIN-коду
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f141a] text-white font-body-md">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1c2229] border-b border-white/10 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#8BA88E] rounded-lg flex items-center justify-center text-white font-bold">E</div>
          <h1 className="font-['Newsreader'] italic text-xl">EvaAdmin</h1>
        </div>
        <button onClick={() => { localStorage.removeItem('admin_token'); setUnauthorized(true); }} className="text-white/40 hover:text-red-400">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </header>

      <main className="p-6 pb-32 max-w-5xl mx-auto space-y-8">
        {/* Navigation */}
        <nav className="flex p-1.5 bg-[#1c2229] rounded-2xl border border-white/5">
          {[
            { id: 'stats', label: 'Статистика', icon: 'query_stats' },
            { id: 'crm', label: 'Пользователи', icon: 'group' },
            { id: 'broadcast', label: 'Рассылка', icon: 'campaign' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id ? 'bg-[#8BA88E] text-white' : 'text-white/40 hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* STATS */}
        {activeTab === 'stats' && stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Пользователей', value: stats.totalUsers, icon: 'person' },
              { label: 'Пройдено тестов', value: stats.completedTests, icon: 'assignment_turned_in' },
              { label: 'Обратились к Еве', value: stats.contactAuthorCount, icon: 'forum' }
            ].map((s, i) => (
              <div key={i} className="p-8 rounded-3xl bg-[#1c2229] border border-white/10 shadow-xl flex items-center gap-6">
                <div className="w-14 h-14 bg-[#8BA88E]/10 rounded-2xl flex items-center justify-center border border-[#8BA88E]/20">
                  <span className="material-symbols-outlined text-[#8BA88E] text-2xl">{s.icon}</span>
                </div>
                <div>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-wider">{s.label}</p>
                  <p className="text-4xl font-['Newsreader'] italic text-[#8BA88E]">{s.value}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* CRM */}
        {activeTab === 'crm' && stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex justify-between items-center px-2">
               <p className="text-sm font-bold text-white/60">{stats.recentUsers.length} пользователей в списке</p>
               <button onClick={toggleAllUsers} className="text-xs text-[#8BA88E] font-bold uppercase hover:underline">
                 {selectedUsers.size === stats.recentUsers.length ? 'Снять всё' : 'Выбрать всех'}
               </button>
            </div>
            <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#1c2229] shadow-2xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="p-5 font-bold text-white/30 text-[10px] uppercase tracking-widest w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedUsers.size === stats.recentUsers.length && stats.recentUsers.length > 0} 
                        onChange={toggleAllUsers}
                        className="w-4 h-4 rounded border-white/10 bg-[#0f141a] text-[#8BA88E] accent-[#8BA88E]"
                      />
                    </th>
                    <th className="p-5 font-bold text-white/30 text-[10px] uppercase tracking-widest">Юзернейм</th>
                    <th className="p-5 font-bold text-white/30 text-[10px] uppercase tracking-widest text-center">Друзья</th>
                    <th className="p-5 font-bold text-white/30 text-[10px] uppercase tracking-widest text-center">Связь</th>
                    <th className="p-5 font-bold text-white/30 text-[10px] uppercase tracking-widest text-right">Почта</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {stats.recentUsers.map(user => (
                    <tr key={user.tg_id} className={`transition-colors ${selectedUsers.has(user.tg_id) ? 'bg-[#8BA88E]/5' : 'hover:bg-white/[0.02]'}`}>
                      <td className="p-5">
                        <input 
                          type="checkbox" 
                          checked={selectedUsers.has(user.tg_id)} 
                          onChange={() => toggleUserSelection(user.tg_id)}
                          className="w-4 h-4 rounded border-white/10 bg-[#0f141a] text-[#8BA88E] accent-[#8BA88E]"
                        />
                      </td>
                      <td className="p-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-[15px]">{user.username || `@${user.tg_id}`}</span>
                          <span className="text-[10px] text-white/20">{new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-5 text-center font-bold text-[#8BA88E]">{user.invites_count}</td>
                      <td className="p-5 text-center">
                        {user.contact_author_clicked ? (
                          <span className="px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold border border-orange-500/20">🔥 Запрос</span>
                        ) : (
                          <span className="text-white/10">—</span>
                        )}
                      </td>
                      <td className="p-5 text-right">
                        <button
                          onClick={() => {
                            setMsgTargetTgId(user.tg_id)
                            setMsgTargetUsername(user.username || String(user.tg_id))
                            setMsgModalOpen(true)
                          }}
                          className="w-10 h-10 rounded-xl bg-white/5 text-[#8BA88E] hover:bg-[#8BA88E] hover:text-white transition-all flex items-center justify-center mx-auto ml-auto"
                        >
                          <span className="material-symbols-outlined text-[20px]">send</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedUsers.size > 0 && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
                <button 
                  onClick={() => setActiveTab('broadcast')}
                  className="bg-[#8BA88E] text-white px-8 py-4 rounded-full font-bold shadow-2xl flex items-center gap-3 active:scale-95"
                >
                  <span className="material-symbols-outlined">campaign</span>
                  Рассылка выбранным ({selectedUsers.size})
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* BROADCAST */}
        {activeTab === 'broadcast' && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto w-full">
            <div className="p-8 rounded-[40px] bg-[#1c2229] border border-white/10 shadow-2xl space-y-8">
              <div className="text-center space-y-2">
                <h3 className="font-['Newsreader'] italic text-[32px]">Создать рассылку</h3>
                <p className="text-xs text-white/40 uppercase font-bold tracking-widest">
                  {selectedUsers.size > 0 ? `Получателей: ${selectedUsers.size}` : 'Всем пользователям'}
                </p>
              </div>

              {/* File Attachment */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-2">Прикрепить фото или файл</label>
                <div className="relative group">
                  <input type="file" onChange={handlePhotoChange} className="hidden" id="broadcast-file" accept="image/*" />
                  <label htmlFor="broadcast-file" className="block w-full cursor-pointer p-10 border-2 border-dashed border-white/10 rounded-[32px] hover:border-[#8BA88E]/50 hover:bg-white/[0.02] transition-all text-center">
                    {broadcastPhotoPreview ? (
                      <div className="relative inline-block">
                        <NextImage src={broadcastPhotoPreview} alt="Preview" width={240} height={160} className="rounded-2xl object-cover" />
                        <button onClick={(e) => { e.preventDefault(); setBroadcastPhoto(null); setBroadcastPhotoPreview(null); }} className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white">✕</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="material-symbols-outlined text-4xl text-white/20">add_photo_alternate</span>
                        <p className="text-sm text-white/30">Нажмите для выбора файла</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-2">Текст сообщения</label>
                <textarea
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="Введите текст (HTML поддерживается)..."
                  rows={5}
                  className="w-full p-6 bg-white/5 border border-white/10 rounded-[32px] text-white focus:border-[#8BA88E] transition-all outline-none resize-none"
                />
              </div>

              <button
                onClick={handleBroadcast}
                disabled={broadcasting || (!broadcastMsg.trim() && !broadcastPhoto)}
                className="w-full py-5 bg-[#8BA88E] text-white text-lg font-bold rounded-[32px] active:scale-95 transition-all shadow-xl shadow-[#8BA88E]/10"
              >
                {broadcasting ? '⏳ Отправка...' : '📢 Запустить рассылку'}
              </button>

              {broadcastResult && (
                <div className="p-6 bg-[#8BA88E]/10 border border-[#8BA88E]/20 rounded-3xl text-center space-y-1">
                  <p className="font-bold text-[#8BA88E]">Рассылка завершена успешно!</p>
                  <p className="text-xs text-white/40">Доставлено: {broadcastResult.sent} | Ошибок: {broadcastResult.failed}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>

      {/* MODAL: CRM Message */}
      <AnimatePresence>
        {msgModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0f141a]/95 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-md bg-[#1c2229] border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-['Newsreader'] italic text-2xl text-[#8BA88E]">Написать @{msgTargetUsername}</h3>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Личное сообщение через бот</p>
                </div>
                <button onClick={() => setMsgModalOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20 hover:text-white">✕</button>
              </div>

              {msgSent ? (
                <div className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 bg-[#8BA88E] rounded-full flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-white text-3xl font-bold">check</span>
                  </div>
                  <p className="font-bold text-[#8BA88E]">Сообщение доставлено!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <textarea
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Ваше сообщение..."
                    rows={4}
                    className="w-full p-6 bg-white/5 border border-white/10 rounded-[28px] text-white outline-none focus:border-[#8BA88E] transition-all"
                  />
                  <button
                    onClick={handleSendDirectMessage}
                    disabled={msgSending || !msgText.trim()}
                    className="w-full py-5 bg-[#8BA88E] text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg"
                  >
                    {msgSending ? '⏳ Отправка...' : '📤 Отправить'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Nav */}
      <div className="fixed bottom-6 left-6 right-6 z-40 max-w-lg mx-auto">
        <button
          onClick={() => router.push('/result')}
          className="w-full py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-white/60 font-bold hover:bg-white/10 active:scale-95 transition-all"
        >
          🔙 Назад в приложение
        </button>
      </div>
    </div>
  )
}
