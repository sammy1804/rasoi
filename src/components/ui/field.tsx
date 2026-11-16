import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] text-ink placeholder:text-ink-mute/80 transition focus:border-ink/30 focus:outline-none focus:ring-4 focus:ring-clay/10',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-mute">{hint}</span>}
    </label>
  )
}

export function NumberInput({
  value,
  onChange,
  suffix,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | '' | undefined
  onChange: (n: number | '') => void
  suffix?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Input
        inputMode="decimal"
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className={cn(suffix && 'pr-9', 'tabular')}
        {...props}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-mute">{suffix}</span>}
    </div>
  )
}
