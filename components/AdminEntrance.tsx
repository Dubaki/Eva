'use client'

import { useRef, useEffect } from 'react'

/**
 * Invisible component that listens for 5 quick clicks on the top of the screen
 * to trigger the admin login prompt.
 */
export default function AdminEntrance() {
  const clicksRef = useRef<number[]>([])

  useEffect(() => {
    const handleGlobalClick = async (e: MouseEvent) => {
      // Только клики в верхней части экрана (верхние 50px)
      if (e.clientY > 50) return

      const now = Date.now()
      clicksRef.current = clicksRef.current.filter((t) => now - t < 2000)
      clicksRef.current.push(now)

      if (clicksRef.current.length >= 5) {
        clicksRef.current = []
        const pin = window.prompt('Введите PIN-код')
        if (pin === null) return

        try {
          const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin }),
          })
          const data = await res.json()

          if (data.success && data.token) {
            localStorage.setItem('admin_token', data.token)
            window.location.href = '/admin'
          } else {
            alert('❌ ' + (data.error || 'Неверный PIN-код'))
          }
        } catch (err) {
          alert('❌ Ошибка авторизации')
        }
      }
    }

    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])

  return null // Невидимый компонент
}
