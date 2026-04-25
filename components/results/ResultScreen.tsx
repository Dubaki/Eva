'use client'

import { motion, AnimatePresence } from 'framer-motion'
import ResultHeader from './ResultHeader'

interface ResultScreenProps {
  imgSrc: string
  title: string
  description: string
  trait: string
  isThinking: boolean
  onAnswer: (val: 'yes' | 'no') => void
}

export default function ResultScreen({ imgSrc, title, description, trait, isThinking, onAnswer }: ResultScreenProps) {
  return (
    <>
      <ResultHeader src={imgSrc} title={title} description={description} trait={trait} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="text-center"
      >
        <AnimatePresence mode="wait">
          {isThinking ? (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-4"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-accent"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <p className="text-text-muted text-xs mt-2">Осмысляю...</p>
            </motion.div>
          ) : (
            <motion.div
              key="question"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-text-primary text-[16px] font-medium mb-3">
                Удивил ли тебя результат?
              </p>
              <div className="flex gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] text-white"
                  style={{ background: '#2563eb' }}
                  onClick={() => onAnswer('yes')}
                >
                  Да
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px] border"
                  style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onClick={() => onAnswer('no')}
                >
                  Нет
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  )
}
