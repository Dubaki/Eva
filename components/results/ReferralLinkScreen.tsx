'use client'

import { motion } from 'framer-motion'
import { Copy, Check } from 'lucide-react'
import { FUNNEL_TEXTS } from '@/lib/constants/results'

interface ReferralLinkScreenProps {
  refLink: string
  copied: boolean
  onCopy: () => void
  onShare: () => void
}

export default function ReferralLinkScreen({ refLink, copied, onCopy, onShare }: ReferralLinkScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="text-center"
    >
      <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-4 text-left">
        Ты можешь получить разбор своей второй опоры, если поделишься тестом с 2 подругами. Для этого тебе нужно скопировать ссылку и отправить подругам. Когда они пройдут тест, тебе придёт ответ.
      </p>
      <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-4 text-left italic">
        Я даю этот доступ в обмен на расширение проекта
      </p>

      {/* Referral link box with copy button */}
      <div className="bg-bg-secondary rounded-xl p-4 border border-border mb-4">
        <div className="flex items-center gap-2">
          <p className="text-accent text-[13px] break-all select-all flex-1 text-left">{refLink}</p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            className="flex-shrink-0 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            onClick={onCopy}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </motion.button>
        </div>
      </div>

      <p className="text-text-secondary text-[14px] leading-relaxed mb-5 text-center">
        {FUNNEL_TEXTS.REFERRAL_LINK.FOOTER}
      </p>
      <div className="flex flex-col gap-3">
        <motion.button type="button" whileTap={{ scale: 0.97 }}
          className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
          style={{ background: '#2563eb' }}
          onClick={onShare}>
          Поделиться
        </motion.button>
      </div>
    </motion.div>
  )
}
