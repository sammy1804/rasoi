import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Chip({ active, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition active:scale-95 focus-ring',
        active ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink-soft hover:border-ink/20 hover:text-ink',
        className,
      )}
      {...props}
    />
  )
}
