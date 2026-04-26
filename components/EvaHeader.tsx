import React from 'react'

interface EvaHeaderProps {
  leftElement?: React.ReactNode
  rightElement?: React.ReactNode
}

export default function EvaHeader({ leftElement, rightElement }: EvaHeaderProps) {
  return (
    <header className="bg-slate-950 dark:bg-[#121417] fixed top-0 left-0 w-full z-50 flex items-center justify-between px-5 h-16 shadow-[0_4px_20px_rgba(18,20,23,0.15)] border-b border-white/5">
      {/* Leading Icon / Element */}
      <div className="w-12 flex items-center justify-start">
        {leftElement || (
          <div className="w-10 h-10 flex items-center justify-start text-[#8BA88E] dark:text-[#8BA88E]">
            <span className="material-symbols-outlined text-2xl">spa</span>
          </div>
        )}
      </div>

      {/* Headline */}
      <div className="flex-1 flex justify-center overflow-hidden">
        <h1 className="text-[#8BA88E] dark:text-[#8BA88E] font-headline-lg italic text-lg tracking-tight m-0 p-0 whitespace-nowrap" style={{ fontFamily: 'var(--font-newsreader)' }}>
          EvaTest
        </h1>
      </div>

      {/* Trailing Icon / Element */}
      <div className="w-12 flex items-center justify-end">
        {rightElement || (
          <button aria-label="More options" className="w-10 h-10 flex items-center justify-end text-slate-500 hover:opacity-70 transition-opacity duration-300 active:scale-98 transition-transform">
            <span className="material-symbols-outlined text-2xl">more_vert</span>
          </button>
        )}
      </div>
    </header>
  )
}
