import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  text: ReactNode
  action?: { label: string; onClick: () => void }
}

const Ctx = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++seq.current
    setItems([{ ...t, id }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.action ? 4500 : 2600)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(150px+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md flex-col items-center gap-2 px-4">
        <AnimatePresence mode="popLayout">
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              role="status"
              className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-ink py-2.5 pl-4 pr-2.5 text-[14px] font-medium text-paper shadow-lift"
            >
              <span className="min-w-0 truncate">{t.text}</span>
              {t.action ? (
                <button
                  onClick={() => {
                    t.action!.onClick()
                    setItems((xs) => xs.filter((x) => x.id !== t.id))
                  }}
                  className="shrink-0 rounded-full bg-paper/15 px-3 py-1 text-[13px] font-semibold text-paper hover:bg-paper/25"
                >
                  {t.action.label}
                </button>
              ) : (
                <span className="w-1.5" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
