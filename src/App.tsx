import { motion } from 'framer-motion'
import { HashRouter, MemoryRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { DayProvider } from '@/app/DayContext'
import { IS_MOBILE_PAGE } from '@/app/target'
import { BottomNav } from '@/components/BottomNav'
import { ToastProvider } from '@/components/Toast'
import { useSession } from '@/hooks/useSession'
import { CookApp } from '@/screens/CookApp'
import { CookLinkScreen } from '@/screens/CookLink'
import { HomeScreen } from '@/screens/Home'
import { HouseLinkScreen } from '@/screens/HouseLink'
import { InviteScreen } from '@/screens/Invite'
import { JoinGate } from '@/screens/JoinGate'
import { LogScreen } from '@/screens/Log'
import { Onboarding } from '@/screens/Onboarding'
import { ProfileScreen } from '@/screens/Profile'
import { ProgressScreen } from '@/screens/Progress'
import { WeekScreen } from '@/screens/Week'

function Shell() {
  const { member, cookAccount } = useSession()
  const location = useLocation()
  if (!member && cookAccount) return <CookApp />
  if (!member) return <Navigate to="/welcome" replace />
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-paper sm:border-x sm:border-line/60">
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pb-[calc(96px+env(safe-area-inset-bottom))]"
      >
        <Outlet />
      </motion.main>
      <BottomNav />
    </div>
  )
}

function JoinRoute() {
  const { code } = useParams()
  return <JoinGate code={(code ?? '').toUpperCase()} />
}

// The claude.ai phone page can't use URLs, so it routes in memory. The public site uses
// hash routes (/#/join/CODE) so it works on GitHub Pages or any static host.
const Router = IS_MOBILE_PAGE ? MemoryRouter : HashRouter

export function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <DayProvider>
          <Routes>
            <Route path="/welcome" element={<Onboarding />} />
            <Route path="/join/:code" element={<JoinRoute />} />
            <Route path="/join" element={<Onboarding initialCode="" />} />
            <Route path="/invite" element={<InviteScreen />} />
            <Route path="/c/:data" element={<CookLinkScreen />} />
            <Route path="/h/:data" element={<HouseLinkScreen />} />
            <Route element={<Shell />}>
              <Route index element={<HomeScreen />} />
              <Route path="/week" element={<WeekScreen />} />
              <Route path="/log" element={<LogScreen />} />
              <Route path="/progress" element={<ProgressScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DayProvider>
      </ToastProvider>
    </Router>
  )
}
