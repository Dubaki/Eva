'use client'

import { motion } from 'framer-motion'
import ResultHeader from './ResultHeader'
import { FUNNEL_TEXTS } from '@/lib/constants/results'

interface SurpriseResponseScreenProps {
  imgSrc: string
  title: string
  description: string
  trait: string
  type: 'yes' | 'no'
  responseRef: React.RefObject<HTMLDivElement>
  onNext: () => void
  onCancel: () => void
}

export default function SurpriseResponseScreen({ imgSrc, title, description, trait, type, responseRef, onNext, onCancel }: SurpriseResponseScreenProps) {
  const text = type === 'yes' ? FUNNEL_TEXTS.SURPRISE_YES : FUNNEL_TEXTS.SURPRISE_NO

  return (
    <>
      <ResultHeader src={imgSrc} title={title} description={description} trait={trait} compact />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="text-center"
        ref={responseRef}
      >
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-blue-600 rounded-r-xl p-4 mb-5 text-left">
          <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap">
            {text.RESPONSE}
          </p>
        </div>
        <p className="text-text-secondary text-[14px] leading-relaxed mb-5 whitespace-pre-wrap text-left">
          Базовая опора — это только часть картины. Есть ещё смешанные конфигурации, которые активируются в стрессе.{' '}
          <b>Хочешь увидеть свою вторую искаженную опору?</b>
        </p>
        <div className="flex gap-3">
          <motion.button type="button" whileTap={{ scale: 0.95 }}
            className="flex-1 py-3 rounded-xl font-semibold text-[15px] text-white"
            style={{ background: '#2563eb' }}
            onClick={onNext}>
            Узнать вторую опору
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.95 }}
            className="flex-1 py-3 rounded-xl font-semibold text-[15px] border"
            style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            onClick={onCancel}>
            Пока не буду
          </motion.button>
        </div>
      </motion.div>
    </>
  )
}
