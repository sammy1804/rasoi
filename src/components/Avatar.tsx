import { hueOf } from '@/app/meta'
import { cn } from '@/lib/utils'

export function Avatar({ name, hue = 0, size = 32, className }: { name: string; hue?: number; size?: number; className?: string }) {
  const h = hueOf(hue)
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-display font-semibold', h.bg, h.text, className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
