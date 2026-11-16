import { motion } from 'framer-motion'
import { BarChart3, CalendarDays, House, NotebookPen, UserRound } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', label: 'Home', icon: House },
  { to: '/week', label: 'Week', icon: CalendarDays },
  { to: '/log', label: 'Log', icon: NotebookPen },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line/80 bg-paper/90 pb-safe backdrop-blur-xl" aria-label="Main">
      <ul className="grid grid-cols-5 px-2">
        {TABS.map((t) => {
          const active = t.to === '/' ? pathname === '/' : pathname.startsWith(t.to)
          const Icon = t.icon
          return (
            <li key={t.to}>
              <NavLink
                to={t.to}
                className={cn('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors focus-ring rounded-xl', active ? 'text-ink' : 'text-ink-mute')}
              >
                {active && <motion.span layoutId="nav-pill" className="absolute top-1.5 h-8 w-14 rounded-full bg-sand" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <Icon size={21} strokeWidth={active ? 2.3 : 1.9} className="relative" />
                <span className="relative">{t.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
