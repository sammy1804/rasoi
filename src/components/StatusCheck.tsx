import { AnimatePresence, motion } from 'framer-motion'
import type { LogStatus } from '@/data/types'
import { cn } from '@/lib/utils'

type S = LogStatus | 'planned'

/** Large, friendly checkbox with four states: ○ planned · ✓ eaten · ◐ partial · × skipped */
export function StatusCheck({
  status,
  onClick,
  onLongPress,
  disabled,
  label,
  pulse,
}: {
  status: S
  onClick?: () => void
  onLongPress?: () => void
  disabled?: boolean
  label: string
  pulse?: boolean
}) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let long = false
  const start = () => {
    long = false
    if (!onLongPress) return
    timer = setTimeout(() => {
      long = true
      onLongPress()
    }, 450)
  }
  const end = () => timer && clearTimeout(timer)
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={status !== 'planned'}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      onContextMenu={(e) => onLongPress && e.preventDefault()}
      onClick={() => {
        if (long) return
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator && status === 'planned') navigator.vibrate?.(8)
        onClick?.()
      }}
      className={cn(
        'relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform active:scale-90 focus-ring disabled:cursor-default',
        disabled && 'active:scale-100',
      )}
    >
      {pulse && <span className="absolute inset-0.5 animate-ping rounded-full bg-clay/25" />}
      <motion.span
        className={cn(
          'relative grid h-7 w-7 place-items-center rounded-full border-2 transition-colors duration-200',
          status === 'planned' && 'border-line bg-card',
          status === 'eaten' && 'border-ink bg-ink',
          status === 'partial' && 'border-ink bg-card',
          status === 'skipped' && 'border-line bg-sand',
          pulse && status === 'planned' && 'border-clay',
        )}
        animate={status === 'eaten' ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
      >
        <AnimatePresence initial={false} mode="wait">
          {status === 'eaten' && (
            <motion.svg key="eaten" viewBox="0 0 24 24" className="h-4 w-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.path
                d="M5 12.5l4.2 4.2L19 7"
                fill="none"
                stroke="rgb(var(--paper))"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              />
            </motion.svg>
          )}
          {status === 'partial' && (
            <motion.span
              key="partial"
              className="absolute inset-[3px] overflow-hidden rounded-full"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="absolute inset-y-0 left-0 w-1/2 bg-ink" />
            </motion.span>
          )}
          {status === 'skipped' && (
            <motion.svg key="skipped" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-ink-mute" initial={{ opacity: 0, rotate: -45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.span>
    </button>
  )
}
