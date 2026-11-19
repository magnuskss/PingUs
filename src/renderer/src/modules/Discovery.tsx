import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Radar, Play, Square, Download, Power, ScanSearch, ChevronDown, Loader2, Wifi,
  Router, Monitor, Laptop, Smartphone, Tablet, Printer, Tv, Gamepad2, Speaker,
  Camera, HardDrive, Server, Cpu, HelpCircle, Activity, type LucideIcon
} from 'lucide-react'
import type { DiscoveredDevice, DeviceType, PresenceUpdate, DeviceProfile, PingResult } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Sparkline } from '../components/charts'
import { Card, CardHeader, Button, Badge, Tag, Toggle, ProgressBar, EmptyState } from '../components/ui'
import { ms, relativeTime } from '../lib/format'
import { saveHistory, toCsv, downloadText } from '../lib/export'

const DEVICE_META: Record<DeviceType, { icon: LucideIcon; label: string }> = {
  router: { icon: Router, label: 'Router' },
  computer: { icon: Monitor, label: 'Computer' },
  laptop: { icon: Laptop, label: 'Laptop' },
  phone: { icon: Smartphone, label: 'Phone' },
  tablet: { icon: Tablet, label: 'Tablet' },
  printer: { icon: Printer, label: 'Printer' },
  tv: { icon: Tv, label: 'TV / Media' },
  console: { icon: Gamepad2, label: 'Console' },
  speaker: { icon: Speaker, label: 'Speaker' },
  camera: { icon: Camera, label: 'Camera' },
  nas: { icon: HardDrive, label: 'NAS' },
  server: { icon: Server, label: 'Server' },
  iot: { icon: Cpu, label: 'Smart device' },
  unknown: { icon: HelpCircle, label: 'Unknown' }
}

const PORT_NAMES: Record<number, string> = {
  22: 'SSH', 80: 'HTTP', 139: 'SMB', 443: 'HTTPS', 445: 'SMB', 515: 'Printer',
  548: 'AFP', 554: 'RTSP', 631: 'IPP', 1400: 'Sonos', 1883: 'MQTT', 3389: 'RDP',
  5000: 'UPnP', 5900: 'VNC', 7000: 'AirPlay', 8009: 'Cast', 8096: 'Jellyfin',
  8554: 'RTSP', 9100: 'JetDirect', 32400: 'Plex', 37777: 'DVR'
}

type WakeState = 'idle' | 'sending' | 'sent' | 'error'

const CONF_RANK: Record<DiscoveredDevice['confidence'], number> = { low: 0, medium: 1, high: 2 }

function ttlHint(ttl: number | null): string {
  if (ttl == null) return '—'
  if (ttl <= 64) return `${ttl} · Apple / Linux / Android`
  if (ttl <= 128) return `${ttl} · Windows`
  return `${ttl} · Embedded / network gear`
}

const PING_WINDOW = 30

/** Live ping to one device while `on` — keeps the last PING_WINDOW samples (null = lost). */
function useDevicePing(ip: string, on: boolean): (number | null)[] {
  const [samples, setSamples] = useState<(number | null)[]>([])
  useEffect(() => {
    if (!on) return
    setSamples([])
    let session: { stop: () => void } | null = null
    let alive = true
    window.pingus
      .startPing(ip, {
        onData: (p) => {
          const r = p as PingResult
          setSamples((s) => [...s.slice(-(PING_WINDOW - 1)), r.success ? r.latencyMs : null])
        }
      })
      .then((s) => (alive ? (session = s) : s.stop()))
    return () => {
      alive = false
      session?.stop()
    }
  }, [ip, on])
  return samples
}

export function Discovery(): JSX.Element {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 254 })
  const [live, setLive] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [profiling, setProfiling] = useState<Set<string>>(new Set())
  const [wake, setWake] = useState<Record<string, WakeState>>({})
  const scanRef = useRef<{ stop: () => void } | null>(null)
  const presenceRef = useRef<{ stop: () => void } | null>(null)

  const start = async (): Promise<void> => {
    presenceRef.current?.stop()
    setLive(false)
    setDevices([])
    setExpanded(null)
    setProgress({ done: 0, total: 254 })
    setRunning(true)
    scanRef.current = await window.pingus.startDiscovery(null, {
      // The scan re-sends a device as it learns more (name, MAC, UPnP) — merge by IP.
      onData: (d) =>
        setDevices((prev) => {
          const dev = d as DiscoveredDevice
          const old = prev.find((p) => p.ip === dev.ip)
          if (!old) return [...prev, dev].sort(sortDevices)
          return prev.map((p) =>
            p.ip === dev.ip
              ? { ...dev, openPorts: p.openPorts, reachable: dev.reachable || p.reachable, latencyMs: dev.latencyMs ?? p.latencyMs }
              : p
          )
        }),
      onProgress: (p) => setProgress(p as { done: number; total: number }),
      onDone: () => {
        setRunning(false)
        setDevices((d) => {
          saveHistory('discovery', 'Network Discovery', null, `${d.length} devices found`, d)
          return d
        })
      },
      onError: () => setRunning(false)
    })
  }

  const stop = (): void => {
    scanRef.current?.stop()
    setRunning(false)
  }

  const toggleLive = async (on: boolean): Promise<void> => {
    setLive(on)
    if (on) {
      const ips = devices.map((d) => d.ip)
      presenceRef.current = await window.pingus.startPresence(ips, {
        onData: (u) => {
          const up = u as PresenceUpdate
          setDevices((prev) =>
            prev.map((d) =>
              d.ip === up.ip
                ? { ...d, reachable: up.reachable, latencyMs: up.latencyMs, lastSeen: up.reachable ? up.lastSeen : d.lastSeen }
                : d
            )
          )
        }
      })
    } else {
      presenceRef.current?.stop()
      presenceRef.current = null
    }
  }

  const identify = async (dev: DiscoveredDevice): Promise<void> => {
    setProfiling((s) => new Set(s).add(dev.ip))
    setExpanded(dev.ip)
    try {
      const prof: DeviceProfile = await window.pingus.profileDevice(dev.ip, dev.mac, dev.hostname, dev.isGateway)
      // Only replace the guess if the port scan is at least as sure as what we had.
      setDevices((prev) =>
        prev.map((d) => {
          if (d.ip !== dev.ip) return d
          const better = !d.isGateway && !d.isSelf && CONF_RANK[prof.confidence] >= CONF_RANK[d.confidence] && prof.deviceType !== 'unknown'
          return better
            ? { ...d, openPorts: prof.openPorts, deviceType: prof.deviceType, confidence: prof.confidence, reason: prof.reason }
            : { ...d, openPorts: prof.openPorts }
        })
      )
    } finally {
      setProfiling((s) => {
        const next = new Set(s)
        next.delete(dev.ip)
        return next
      })
    }
  }

  const doWake = async (dev: DiscoveredDevice): Promise<void> => {
    if (!dev.mac) return
    setWake((w) => ({ ...w, [dev.ip]: 'sending' }))
    const res = await window.pingus.wakeOnLan(dev.mac)
    setWake((w) => ({ ...w, [dev.ip]: res.ok ? 'sent' : 'error' }))
    setTimeout(() => setWake((w) => ({ ...w, [dev.ip]: 'idle' })), 2600)
  }

  useEffect(
    () => () => {
      scanRef.current?.stop()
      presenceRef.current?.stop()
    },
    []
  )

  const exportCsv = (): void => {
    const csv = toCsv(
      devices.map((d) => ({
        ip: d.ip, name: d.friendlyName ?? '', hostname: d.hostname ?? '', vendor: d.vendor ?? '', model: d.model ?? '',
        type: DEVICE_META[d.deviceType].label, confidence: d.confidence, reason: d.reason,
        mac: d.mac ?? '', online: d.reachable ? 'yes' : 'no', latency_ms: d.latencyMs ?? ''
      }))
    )
    downloadText(`pingus-devices-${Date.now()}.csv`, csv, 'text/csv')
  }

  const online = devices.filter((d) => d.reachable).length
  const pctDone = (progress.done / progress.total) * 100
  const typeCounts = countTypes(devices)

  return (
    <div>
      <PageHeader
        title="Network Discovery"
        subtitle="Sweep your local network, identify what each device is, wake sleeping machines and watch who's online."
        actions={
          <>
            <Button icon={<Download size={15} />} onClick={exportCsv} disabled={!devices.length}>Export</Button>
            {running ? (
              <Button variant="danger" icon={<Square size={14} />} onClick={stop}>Stop</Button>
            ) : (
              <Button variant="primary" icon={<Play size={14} />} onClick={start}>Scan network</Button>
            )}
          </>
        }
      />

      {/* Summary strip */}
      <Card className="p-5 mb-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-baseline gap-2.5">
            <span className="text-stat font-semibold text-ink-50 tabular-nums leading-none">{devices.length}</span>
            <span className="label">devices</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-good shadow-[0_0_8px_rgba(62,224,143,0.65)]' : 'bg-ink-500'}`} />
            <span className="text-ink-200"><span className="tabular-nums font-medium text-ink-50">{online}</span> online</span>
          </div>

          <div className="h-8 w-px bg-[var(--hair-strong)] hidden sm:block" />

          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {typeCounts.length ? (
              typeCounts.map(({ type, count }) => {
                const Icon = DEVICE_META[type].icon
                return (
                  <Tag key={type} icon={<Icon size={13} />}>
                    {DEVICE_META[type].label} <span className="text-ink-400 tabular-nums">{count}</span>
                  </Tag>
                )
              })
            ) : (
              <span className="text-sm text-ink-500">Run a scan to map the network.</span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {running && (
              <div className="w-32">
                <ProgressBar pct={pctDone} />
                <div className="mt-1.5 text-[0.625rem] text-ink-500 tabular-nums text-right">{progress.done}/{progress.total} hosts</div>
              </div>
            )}
            <Toggle checked={live} onChange={toggleLive} label="Live" />
          </div>
        </div>
      </Card>

      {/* Device list */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--hair)]">
          <CardHeader title="Devices" />
          <div className="flex items-center gap-2">
            {live && <Badge tone="accent"><Wifi size={11} /> watching</Badge>}
            <Badge tone="outline">local subnet</Badge>
          </div>
        </div>

        {!devices.length && !running && (
          <EmptyState
            icon={<Radar size={28} />}
            title="No devices discovered yet"
            hint="Scan your network to list every device, with its vendor, likely type and online status. Only scan networks you own or are authorized to test."
          />
        )}
        {!devices.length && running && <EmptyState icon={<Radar size={28} className="animate-pulse text-accent" />} title="Sweeping the subnet…" />}

        <div className="divide-y divide-[var(--hair)]">
          {devices.map((d, i) => (
            <DeviceRow
              key={d.ip}
              dev={d}
              index={i}
              expanded={expanded === d.ip}
              profiling={profiling.has(d.ip)}
              wake={wake[d.ip] ?? 'idle'}
              onToggle={() => setExpanded((e) => (e === d.ip ? null : d.ip))}
              onIdentify={() => identify(d)}
              onWake={() => doWake(d)}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}

function DeviceRow({
  dev, index, expanded, profiling, wake, onToggle, onIdentify, onWake
}: {
  dev: DiscoveredDevice
  index: number
  expanded: boolean
  profiling: boolean
  wake: WakeState
  onToggle: () => void
  onIdentify: () => void
  onWake: () => void
}): JSX.Element {
  const meta = DEVICE_META[dev.deviceType]
  const Icon = meta.icon
  const title = dev.friendlyName || dev.hostname || dev.vendor || dev.ip
  const wakeLabel = { idle: 'Wake', sending: 'Waking…', sent: 'Sent', error: 'Failed' }[wake]
  const typeLabel =
    dev.deviceType === 'unknown' ? meta.label : dev.confidence === 'low' ? `${meta.label}?` : meta.label
  const [pinging, setPinging] = useState(false)
  const samples = useDevicePing(dev.ip, pinging)
  const got = samples.filter((s): s is number => s != null)
  const lastPing = samples.length ? samples[samples.length - 1] : undefined
  const loss = samples.length ? Math.round(((samples.length - got.length) / samples.length) * 100) : 0
  const avg = got.length ? got.reduce((a, b) => a + b, 0) / got.length : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.015, 0.25) }}
    >
      <div className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
        {/* Type icon */}
        <div
          className={`h-10 w-10 rounded-panel flex items-center justify-center shrink-0 border ${
            dev.reachable ? 'bg-accent/[0.08] border-accent/20 text-accent-soft' : 'bg-ink-800 border-[var(--hair)] text-ink-500'
          }`}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1 selectable">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink-50 truncate max-w-[240px]">{title}</span>
            {dev.isGateway && <Badge tone="accent">Gateway</Badge>}
            {dev.isSelf && <Badge tone="outline">This PC</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-500">
            <span className="font-mono tabular-nums text-ink-300">{dev.ip}</span>
            {dev.vendor && !dev.isSelf && <><span>·</span><span className="truncate max-w-[160px]">{dev.vendor}</span></>}
            {dev.model && <><span>·</span><span className="truncate max-w-[160px]">{dev.model}</span></>}
          </div>
        </div>

        {/* Type guess (md+) */}
        <div className="hidden md:flex w-32 shrink-0 flex-col items-start gap-1" title={dev.reason}>
          <Tag icon={<Icon size={12} />}>{typeLabel}</Tag>
          <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-ink-500">
            {dev.confidence} confidence
          </span>
        </div>

        {/* Live ping (while on) */}
        {pinging && (
          <div className="hidden sm:flex w-28 shrink-0 flex-col items-end">
            <Sparkline data={got}width={96} height={22} strokeWidth={1.25} />
            <span className={`font-mono text-[0.625rem] tabular-nums ${lastPing === null ? 'text-bad' : 'text-ink-300'}`}>
              {lastPing === undefined ? 'pinging…' : lastPing === null ? 'timeout' : `${ms(lastPing, 0)} ms`}
            </span>
          </div>
        )}

        {/* MAC (lg+) */}
        <div className="hidden lg:block w-36 shrink-0 text-xs font-mono text-ink-500 tabular-nums truncate selectable">
          {dev.mac ?? '—'}
        </div>

        {/* Status */}
        <div className="w-24 shrink-0 text-right">
          {dev.reachable ? (
            <>
              <div className="inline-flex items-center gap-1.5 text-xs text-good">
                <span className="h-1.5 w-1.5 rounded-full bg-good" /> Online
              </div>
              <div className="text-[0.625rem] text-ink-500 tabular-nums mt-0.5">
                {dev.latencyMs != null ? `${ms(dev.latencyMs, 0)} ms` : ''}
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                <span className="h-1.5 w-1.5 rounded-full bg-ink-600" /> Offline
              </div>
              {dev.lastSeen > 0 && <div className="text-[0.625rem] text-ink-600 mt-0.5">{relativeTime(dev.lastSeen)}</div>}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant={pinging ? 'primary' : 'ghost'}
            icon={<Activity size={13} />}
            onClick={() => setPinging((p) => !p)}
            title={pinging ? 'Stop pinging this device' : 'Ping this device continuously'}
          >
            {pinging ? 'Stop' : 'Ping'}
          </Button>
          {dev.mac && !dev.isSelf && (
            <Button
              size="sm"
              variant={wake === 'sent' ? 'primary' : 'ghost'}
              icon={wake === 'sending' ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
              onClick={onWake}
              disabled={wake === 'sending'}
              title="Send a Wake-on-LAN magic packet"
            >
              {wakeLabel}
            </Button>
          )}
          <Button
            size="sm"
            variant="quiet"
            icon={profiling ? <Loader2 size={13} className="animate-spin" /> : <ScanSearch size={13} />}
            onClick={onIdentify}
            title="Scan this device for the services it exposes"
          >
            Identify
          </Button>
          <button
            onClick={onToggle}
            className="no-drag p-1.5 text-ink-500 hover:text-ink-100 transition-colors"
            aria-label="Toggle details"
          >
            <ChevronDown size={15} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pl-[76px] selectable">
              <div className="rounded-panel bg-ink-900 border border-[var(--hair)] p-4">
                <div className="mb-3.5 flex items-start gap-2.5 text-sm">
                  <Icon size={15} className="mt-0.5 shrink-0 text-ink-300" />
                  <div>
                    <span className="text-ink-50">
                      {dev.deviceType === 'unknown' ? 'Not sure what this is' : `Probably a ${meta.label.toLowerCase()}`}
                    </span>
                    <span className="text-ink-400"> — {dev.reason}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <Detail label="Announced name" value={dev.friendlyName ?? '—'} />
                  <Detail label="Hostname" value={dev.hostname ?? '—'} />
                  <Detail label="Vendor" value={dev.vendor ?? 'Unknown'} />
                  <Detail label="Model" value={dev.model ?? '—'} />
                  <Detail label="MAC" value={dev.mac ?? '—'} mono />
                  <Detail label="TTL · OS hint" value={ttlHint(dev.ttl)} />
                  <Detail label="Source" value={dev.type === 'arp' ? 'ARP / UPnP' : 'Ping reply'} />
                  <Detail
                    label="Ping"
                    value={
                      pinging && samples.length
                        ? `${avg != null ? ms(avg, 0) + ' ms avg' : 'no replies'} · ${loss}% loss`
                        : dev.latencyMs != null
                          ? `${ms(dev.latencyMs, 0)} ms`
                          : '—'
                    }
                  />
                </div>

                <div className="rule-fade my-3.5" />

                <div className="label mb-2.5">Exposed services</div>
                {profiling ? (
                  <div className="flex items-center gap-2 text-sm text-ink-400">
                    <Loader2 size={14} className="animate-spin text-accent" /> Scanning common ports…
                  </div>
                ) : dev.openPorts == null ? (
                  <p className="text-sm text-ink-500">
                    Press <span className="text-ink-300">Identify</span> to scan this device for the services it's running.
                  </p>
                ) : dev.openPorts.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {dev.openPorts.map((p) => (
                      <Tag key={p} tone="accent">
                        <span className="tabular-nums">{p}</span>
                        {PORT_NAMES[p] && <span className="text-accent/70">{PORT_NAMES[p]}</span>}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-500">No common service ports responded — the device is likely firewalled or idle.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className={`text-ink-100 mt-1 truncate ${mono ? 'font-mono text-[0.8125rem] tabular-nums' : ''}`}>{value}</div>
    </div>
  )
}

function sortDevices(a: DiscoveredDevice, b: DiscoveredDevice): number {
  if (a.isGateway !== b.isGateway) return a.isGateway ? -1 : 1
  if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1
  return ipNum(a.ip) - ipNum(b.ip)
}

function countTypes(devices: DiscoveredDevice[]): { type: DeviceType; count: number }[] {
  const map = new Map<DeviceType, number>()
  for (const d of devices) map.set(d.deviceType, (map.get(d.deviceType) ?? 0) + 1)
  return [...map.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

function ipNum(ip: string): number {
  return ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0)
}
