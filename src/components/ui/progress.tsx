import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function ProgressBar({
  value,
  max,
  className,
  barClassName,
  marker,
}: {
  value: number
  max: number
  className?: string
  barClassName?: string
  /** optional tick (e.g. protein minimum) as a value */
  marker?: number
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-sand', className)}>
      <motion.div
        className={cn('h-full rounded-full bg-ink', barClassName)}
        initial={false}
        animate={{ width: `${pct * 100}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
      {marker !== undefined && max > 0 && marker < max && (
        <span className="absolute top-0 h-full w-[2px] bg-paper/90" style={{ left: `${(marker / max) * 100}%` }} />
      )}
    </div>
  )
}

export function Ring({
  value,
  max,
  size = 64,
  stroke = 7,
  className,
  color = 'rgb(var(--ink))',
  children,
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  className?: string
  color?: string
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--sand))" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: 'spring', stiffness: 110, damping: 20 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
