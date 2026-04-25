'use client'

import { motion } from 'framer-motion'

interface ReferralGateScreenProps {
  onConfirm: () => void
  onClose: () => void
}

export default function ReferralGateScreen({ onConfirm, onClose }: ReferralGateScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="text-center"
    >
      <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-5 text-left">
        <b>Я обычно открываю этот слой только тем, кто идёт в работу.</b>
      </p>
      <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-5 text-left">
        Потому что важно не просто увидеть, а понять, как это устроено и что с этим делать.
      </p>
      <p className="text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap mb-5 text-left">
        Сейчас у тебя есть возможность открыть свою вторую опору через участие
      </p>
      <div className="flex flex-col gap-3">
        <motion.button type="button" whileTap={{ scale: 0.97 }}
          className="w-full py-3 rounded-xl font-semibold text-[15px] text-white"
          style={{ background: '#2563eb' }}
          onClick={onConfirm}>
          Открыть за рекомендацию
        </motion.button>
        <motion.button type="button" whileTap={{ scale: 0.97 }}
          className="w-full py-3 rounded-xl font-semibold text-[15px] border"
          style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          onClick={onClose}>
          Пока не буду узнавать вторую опору
        </motion.button>
      </div>
    </motion.div>
  )
}
