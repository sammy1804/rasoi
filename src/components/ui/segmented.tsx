import { motion } from 'framer-motion'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Option<T extends string> {
  value: T
  label: ReactNode
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: Option<T>[]
  className?: string
  size?: 'sm' | 'md'
}) {
  const id = useId()
  return (
    <div role="radiogroup" className={cn('flex rounded-full bg-sand p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex-1 rounded-full font-semibold transition-colors focus-ring',
              size === 'sm' ? 'h-8 px-2 text-[13px]' : 'h-10 px-3 text-sm',
              active ? 'text-ink' : 'text-ink-mute hover:text-ink-soft',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-card shadow-soft"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
