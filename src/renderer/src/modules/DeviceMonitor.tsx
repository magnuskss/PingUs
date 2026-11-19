import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MonitorDot, Plus, Play, Square, X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Stat, Field, Button, Badge, EmptyState, StatusDot } from '../components/ui'
import { Sparkline } from '../components/charts'
import { ms, relativeTime } from '../lib/format'

interface Monitored {
  host: string
  label: string
  online: boolean | null
  latencyMs: number | null
  history: number[]
  lastChange: number
  checks: number
  up: number
}

const STORAGE_KEY = 'pingus.monitor.hosts'

function loadHosts(): { host: string; label: string }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return [{ host: '1.1.1.1', label: 'Cloudflare DNS' }, { host: '8.8.8.8', label: 'Google DNS' }]
}

export function DeviceMonitor(): JSX.Element {
  const [devices, setDevices] = useState<Monitored[]>(() =>
    loadHosts().map((h) => ({ ...h, online: null, latencyMs: null, history: [], lastChange: Date.now(), checks: 0, up: 0 }))
  )
  const [running, setRunning] = useState(false)
  const [newHost, setNewHost] = useState('')
  const timer = useRef<ReturnType<typeof setInterval>>()
  const devicesRef = useRef(devices)
  devicesRef.current = devices

  const persist = (list: Monitored[]): void => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.map((d) => ({ host: d.host, label: d.label })))) } catch { /* ignore */ }
  }

  const tick = async (): Promise<void> => {
    const current = devicesRef.current
    const results = await Promise.all(current.map((d) => window.pingus.pingOnce(d.host)))
    setDevices((prev) =>
      prev.map((d, i) => {
        const r = results[i]
        const online = r.success
        const changed = d.online !== null && d.online !== online
        return {
          ...d,
          online,
          latencyMs: r.latencyMs,
          history: [...d.history.slice(-29), r.latencyMs ?? 0],
          lastChange: changed ? Date.now() : d.lastChange,
          checks: d.checks + 1,
          up: d.up + (online ? 1 : 0)
        }
      })
    )
  }

  const start = (): void => {
    setRunning(true)
    tick()
    timer.current = setInterval(tick, 5000)
  }
  const stop = (): void => {
    setRunning(false)
    clearInterval(timer.current)
  }
  useEffect(() => () => clearInterval(timer.current), [])

  const add = (): void => {
    const host = newHost.trim()
    if (!host) return
    setDevices((prev) => {
      if (prev.some((d) => d.host === host)) return prev
      const next = [...prev, { host, label: host, online: null, latencyMs: null, history: [], lastChange: Date.now(), checks: 0, up: 0 }]
      persist(next)
      return next
    })
    setNewHost('')
  }
  const remove = (host: string): void => {
    setDevices((prev) => {
      const next = prev.filter((d) => d.host !== host)
      persist(next)
      return next
    })
  }

  const onlineCount = devices.filter((d) => d.online === true).length
  const offlineCount = devices.filter((d) => d.online === false).length

  return (
    <div>
      <PageHeader
        title="Device Monitor"
        subtitle="Continuously watch hosts and detect when they go offline"
        actions={
          running ? (
            <Button variant="danger" icon={<Square size={14} />} onClick={stop}>Stop</Button>
          ) : (
            <Button variant="primary" icon={<Play size={14} />} onClick={start} disabled={!devices.length}>Start Monitoring</Button>
          )
        }
      />

      <div className="flex items-center gap-3 mb-5">
        <Field className="max-w-sm flex-1" icon={<Plus size={15} />} placeholder="Add host or IP to monitor"
          value={newHost} onChange={(e) => setNewHost(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button onClick={add}>Add</Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-6 md:col-span-3 p-5"><Stat value={String(devices.length)} label="Monitored" /></Card>
        <Card className="col-span-6 md:col-span-3 p-5">
          <div className="flex items-center gap-2"><ArrowUpCircle size={18} className="text-ink-100" /><Stat value={String(onlineCount)} label="Online" /></div>
        </Card>
        <Card className="col-span-6 md:col-span-3 p-5">
          <div className="flex items-center gap-2"><ArrowDownCircle size={18} className="text-ink-500" /><Stat value={String(offlineCount)} label="Offline" /></div>
        </Card>
        <Card className="col-span-6 md:col-span-3 p-5 flex items-center">
          <StatusDot state={running ? 'good' : 'idle'} label={running ? 'Monitoring · 5s' : 'Paused'} pulse={running} />
        </Card>

        <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.length === 0 && (
            <Card className="col-span-full p-6">
              <EmptyState icon={<MonitorDot size={28} />} title="No devices monitored" hint="Add hosts or IPs above, then press Start Monitoring." />
            </Card>
          )}
          <AnimatePresence>
            {devices.map((d) => {
              const uptime = d.checks ? (d.up / d.checks) * 100 : null
              return (
                <motion.div key={d.host} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
                  <Card className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${d.online === null ? 'bg-ink-600' : d.online ? 'bg-ink-50 pulse-dot' : 'bg-ink-600'}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink-100 truncate">{d.label}</div>
                          <div className="text-xs text-ink-500 font-mono">{d.host}</div>
                        </div>
                      </div>
                      <button onClick={() => remove(d.host)} className="no-drag text-ink-600 hover:text-ink-200 shrink-0"><X size={14} /></button>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-semibold text-ink-50 tabular-nums">
                          {d.online ? ms(d.latencyMs, 0) : d.online === false ? 'Down' : '—'}
                          {d.online && <span className="text-ink-400 text-xs ml-1">ms</span>}
                        </div>
                        <Badge tone="outline">{uptime != null ? `${uptime.toFixed(0)}% up` : 'no data'}</Badge>
                      </div>
                      <div className="w-24"><Sparkline data={d.history.length > 1 ? d.history : []} height={40} /></div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/[0.05] text-[0.6875rem] text-ink-500">
                      {d.online === null ? 'Awaiting first check' : `${d.online ? 'Online' : 'Offline'} · changed ${relativeTime(d.lastChange)}`}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
