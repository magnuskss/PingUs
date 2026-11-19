import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TopBar } from './components/TopBar'
import { PageMetaContext } from './components/PageHeader'
import { BootSequence, Hatch, ScanSweep } from './components/fx'
import type { ModuleId } from '@shared/types'
import { NAV, GROUP_LABELS } from './lib/nav'

import { Overview } from './modules/Overview'
import { LivePing } from './modules/LivePing'
import { Traceroute } from './modules/Traceroute'
import { DnsAnalyzer } from './modules/DnsAnalyzer'
import { SpeedTest } from './modules/SpeedTest'
import { Discovery } from './modules/Discovery'
import { PortScanner } from './modules/PortScanner'
import { WifiAnalyzer } from './modules/WifiAnalyzer'
import { PacketAnalyzer } from './modules/PacketAnalyzer'
import { DeviceMonitor } from './modules/DeviceMonitor'
import { OsintSearch } from './modules/OsintSearch'
import { HistoryView } from './modules/HistoryView'
import { SettingsView } from './modules/SettingsView'

const MODULES: Record<ModuleId, () => JSX.Element> = {
  overview: Overview,
  ping: LivePing,
  traceroute: Traceroute,
  dns: DnsAnalyzer,
  speedtest: SpeedTest,
  discovery: Discovery,
  ports: PortScanner,
  wifi: WifiAnalyzer,
  packets: PacketAnalyzer,
  devices: DeviceMonitor,
  osint: OsintSearch,
  history: HistoryView,
  settings: SettingsView
}

export default function App(): JSX.Element {
  const [active, setActive] = useState<ModuleId>('overview')
  const Current = MODULES[active]
  const index = NAV.findIndex((n) => n.id === active)
  const item = NAV[index]

  return (
    <div className="app-bg h-full w-full flex flex-col overflow-hidden text-ink-100">
      <BootSequence />
      <TopBar active={active} onSelect={setActive} />

      <main className="relative flex-1 overflow-y-auto">
        <ScanSweep playKey={active} />
        <PageMetaContext.Provider value={{ index: index + 1, group: item ? GROUP_LABELS[item.group] : '' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(2px)' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="px-6 pt-10 pb-10 max-w-[1500px] mx-auto"
            >
              <Current />
            </motion.div>
          </AnimatePresence>
        </PageMetaContext.Provider>
      </main>

      <StatusBar />
      <div className="scanlines fixed inset-0 z-[70]" />
    </div>
  )
}

function StatusBar(): JSX.Element {
  const [start] = useState(() => Date.now())
  const [, force] = useState(0)
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000)
    const sync = (): void => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      clearInterval(id)
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])
  const s = Math.floor((Date.now() - start) / 1000)
  const up = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')

  return (
    <footer className="h-8 shrink-0 flex items-center gap-5 px-6 border-t border-[var(--hair)] bg-ink-900/90 font-mono text-[0.625rem] tracking-[0.14em] uppercase text-ink-500">
      <span className="flex items-center gap-2 text-ink-300">
        <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-good pulse-dot' : 'bg-bad'}`} /> {online ? 'Online' : 'Offline'}
      </span>
      <span>Session {up}</span>
      <span className="hidden md:inline">Authorized networks only</span>
      <span className="flex-1" />
      <Hatch className="h-2.5 w-16" dim />
      <span>PingUs</span>
    </footer>
  )
}
