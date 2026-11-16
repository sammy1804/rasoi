import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function Switch({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors focus-ring', checked ? 'bg-clay' : 'bg-line', className)}
    >
      <motion.span
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-soft"
        initial={false}
        animate={{ left: checked ? 24 : 4 }}
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
      />
    </button>
  )
}
