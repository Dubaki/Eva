export default function EvaHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-container-padding bg-surface/80 backdrop-blur-lg border-b border-outline/10">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[28px]">spa</span>
        <span className="font-headline-md italic text-primary">EVA</span>
      </div>
      <div className="flex items-center gap-4">
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface/70 hover:bg-surface-variant transition-colors">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>
    </header>
  )
}
