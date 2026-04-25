'use client'

import { motion } from 'framer-motion'
import ResultImage from './ResultImage'

interface ResultHeaderProps {
  src: string
  title: string
  description: string
  trait: string
  compact?: boolean
}

export default function ResultHeader({ src, title, description, trait, compact = false }: ResultHeaderProps) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full rounded-2xl overflow-hidden mx-auto"
        style={{ 
          maxHeight: compact ? '30vh' : '40vh', 
          minHeight: compact ? '160px' : '200px',
          width: '100%'
        }}
      >
        <ResultImage src={src} alt={`Результат: ${title}`} trait={trait} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
        className="text-center"
      >
        {!compact && (
          <p className="text-text-muted text-xs uppercase tracking-widest mb-3">
            Ваша доминирующая опора
          </p>
        )}
        <h1 className={`${compact ? 'text-[24px]' : 'text-[28px]'} font-bold tracking-[-0.02em] leading-tight`} style={{ color: 'var(--accent)' }}>
          {title}
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="bg-bg-secondary rounded-xl p-5 border border-border"
      >
        <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap">{description}</p>
      </motion.div>
    </>
  )
}
