'use client'

import { motion } from 'framer-motion'
import { FUNNEL_TEXTS } from '@/lib/constants/results'

interface CooldownScreenProps {
  onConfirm: () => void
  onClose: () => void
}

export default function CooldownScreen({ onConfirm, onClose }: CooldownScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="text-center"
    >
      <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-6">
        {FUNNEL_TEXTS.COOLDOWN}
      </p>
      <div className="flex flex-col gap-3">
        <motion.button type="button" whileTap={{ scale: 0.97 }}
          className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
          style={{ background: '#2563eb' }}
          onClick={onConfirm}>
          Узнать вторую опору
        </motion.button>
        <motion.button type="button" whileTap={{ scale: 0.97 }}
          className="w-full py-3 rounded-xl font-semibold text-[15px] border"
          style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          onClick={onClose}>
          Узнаю через 2 месяца
        </motion.button>
      </div>
    </motion.div>
  )
}
