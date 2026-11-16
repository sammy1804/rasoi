import { Drawer } from 'vaul'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** hide visual title (still announced) */
  bare?: boolean
}

/** Bottom sheet (shadcn "Drawer" pattern on top of vaul / Radix Dialog). */
export function Sheet({ open, onOpenChange, title, description, children, footer, className, bare }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-paper shadow-lift outline-none',
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line" />
          <div className={cn('flex items-start gap-3 px-5 pb-2 pt-3', bare && 'sr-only')}>
            <div className="min-w-0 flex-1">
              <Drawer.Title className="font-display text-[22px] leading-tight tracking-tight">{title}</Drawer.Title>
              {description ? <Drawer.Description className="mt-1 text-sm text-ink-soft">{description}</Drawer.Description> : <Drawer.Description className="sr-only">{typeof title === 'string' ? title : 'Details'}</Drawer.Description>}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="-mr-1 mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-ink-soft transition hover:text-ink focus-ring"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
          {footer ? <div className="border-t border-line/70 bg-paper px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">{footer}</div> : <div className="pb-safe" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
