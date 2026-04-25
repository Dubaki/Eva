'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function ResultImage({ src, alt, trait }: { src: string; alt: string; trait: string }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/10 to-accent/10 rounded-2xl border border-accent/20">
        <div className="text-4xl font-bold text-accent opacity-50 mb-2">{trait}</div>
        <div className="w-12 h-1 border-t border-accent/30" />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      className="object-contain"
      onError={() => setError(true)}
    />
  )
}
