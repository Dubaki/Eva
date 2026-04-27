import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Newsreader, Manrope } from 'next/font/google'
import { AuthProvider } from '@/components/providers/AuthProvider'
import Gatekeeper from '@/components/Gatekeeper'
import { QUESTIONS } from '@/lib/questions'
import './globals.css'

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EVA — Тест на искажённые опоры',
  description: `Узнайте свою скрытую опору. Пройдите тест из ${QUESTIONS.length} вопросов и откройте механизм, который мешает двигаться дальше.`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

import AdminEntrance from '@/components/AdminEntrance'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={`dark ${newsreader.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="bg-[#0f141a] text-[#dee2ec] font-body-md min-h-screen">
        <AuthProvider>
          <Script
            src="https://telegram.org/js/telegram-web-app.js"
            strategy="beforeInteractive"
          />
          <AdminEntrance />
          <Gatekeeper>
            {children}
          </Gatekeeper>
        </AuthProvider>
      </body>
    </html>
  )
}
