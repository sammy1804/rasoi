import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ISODate } from '@/data/types'
import { WEEKDAY_SHORT, addDays, fromISO, todayISO, weekDates } from '@/lib/dates'
import { cn } from '@/lib/utils'

export function DayStrip({ date, onChange, marks }: { date: ISODate; onChange: (d: ISODate) => void; marks?: (d: ISODate) => number }) {
  const days = weekDates(date)
  const today = todayISO()
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(addDays(date, -7))} className="grid h-9 w-7 shrink-0 place-items-center rounded-full text-ink-mute hover:text-ink focus-ring" aria-label="Previous week">
        <ChevronLeft size={18} />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((d, i) => {
          const active = d === date
          const isToday = d === today
          const m = marks?.(d) ?? 0
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              aria-label={`${WEEKDAY_SHORT[i]} ${fromISO(d).getDate()}${isToday ? ', today' : ''}`}
              aria-current={active ? 'date' : undefined}
              className={cn('relative flex h-[52px] flex-col items-center justify-center rounded-2xl transition-colors focus-ring', active ? 'text-paper' : 'text-ink-soft hover:bg-sand/60')}
            >
              {active && <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className={cn('relative text-[10px] font-semibold uppercase tracking-wide', active ? 'text-paper/70' : isToday ? 'text-clay' : 'text-ink-mute')}>{WEEKDAY_SHORT[i].slice(0, 3)}</span>
              <span className="relative text-[15px] font-semibold tabular">{fromISO(d).getDate()}</span>
              <span className="relative mt-0.5 flex h-1 gap-[2px]">
                {[0, 1, 2, 3].map((k) => (
                  <span key={k} className={cn('h-1 w-1 rounded-full', k < m ? (active ? 'bg-paper' : 'bg-ink/70') : active ? 'bg-paper/25' : 'bg-transparent')} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <button onClick={() => onChange(addDays(date, 7))} className="grid h-9 w-7 shrink-0 place-items-center rounded-full text-ink-mute hover:text-ink focus-ring" aria-label="Next week">
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
