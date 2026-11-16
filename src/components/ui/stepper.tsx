import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  format = (n) => String(n),
  className,
  label,
}: {
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
  max?: number
  format?: (n: number) => string
  className?: string
  label?: string
}) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 1000) / 1000)))
  return (
    <div className={cn('flex min-w-0 items-center gap-1 rounded-full border border-line bg-card p-1', className)}>
      <button
        type="button"
        aria-label={`Decrease ${label ?? ''}`}
        onClick={() => set(value - step)}
        disabled={value <= min}
        className="grid h-9 w-9 place-items-center rounded-full bg-sand text-ink transition active:scale-90 disabled:opacity-30 focus-ring"
      >
        <Minus size={16} />
      </button>
      <span className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold tabular">{format(value)}</span>
      <button
        type="button"
        aria-label={`Increase ${label ?? ''}`}
        onClick={() => set(value + step)}
        disabled={value >= max}
        className="grid h-9 w-9 place-items-center rounded-full bg-sand text-ink transition active:scale-90 disabled:opacity-30 focus-ring"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
