import React from 'react'

export default function EvaHeader() {
  const handleClose = () => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.close()
    }
  }

  return (
    <header className="bg-slate-950 dark:bg-[#121417] fixed top-0 left-0 w-full z-50 flex items-center justify-between px-5 h-16 shadow-[0_4px_20px_rgba(18,20,23,0.15)] border-b border-white/5">
      {/* Close Icon */}
      <button 
        onClick={handleClose}
        aria-label="Close" 
        className="w-10 h-10 flex items-center justify-start text-on-surface/70 hover:opacity-70 transition-opacity duration-300 active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-2xl">close</span>
      </button>

      {/* Headline */}
      <div className="flex-1 flex justify-center overflow-hidden">
        <h1 className="text-[#8BA88E] dark:text-[#8BA88E] font-headline-lg italic text-lg tracking-tight m-0 p-0 whitespace-nowrap" style={{ fontFamily: 'var(--font-newsreader)' }}>
          EvaTest
        </h1>
      </div>

      {/* Trailing Icons */}
      <div className="flex items-center justify-end gap-1">
        <button aria-label="Collapse" className="w-8 h-10 flex items-center justify-end text-on-surface/70 hover:opacity-70 transition-opacity duration-300 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-2xl">expand_more</span>
        </button>
        <button aria-label="More options" className="w-8 h-10 flex items-center justify-end text-on-surface/70 hover:opacity-70 transition-opacity duration-300 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-2xl">more_vert</span>
        </button>
      </div>
    </header>
  )
}
