import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Wifi, RefreshCw, Save, WifiOff } from 'lucide-react'
import type { WifiInfo, WifiNetwork } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Stat, Label, Button, Badge, EmptyState, StatusDot, Spinner } from '../components/ui'
import { saveHistory } from '../lib/export'

export function WifiAnalyzer(): JSX.Element {
  const [info, setInfo] = useState<WifiInfo | null>(null)
  const [networks, setNetworks] = useState<WifiNetwork[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    setLoading(true)
    const [i, n] = await Promise.all([window.pingus.wifiInfo(), window.pingus.wifiScan()])
    setInfo(i)
    setNetworks(n.sort((a, b) => (b.signalPct ?? 0) - (a.signalPct ?? 0)))
    setLoading(false)
    if (i.connected) await saveHistory('wifi', `Wi-Fi ${i.ssid}`, i.ssid, `${i.signalPct ?? '—'}% · ch ${i.channel ?? '—'} · ${n.length} nearby`, { info: i, networks: n })
  }
  useEffect(() => { load() }, [])

  // Channel usage distribution (2.4GHz + 5GHz)
  const channelCounts = new Map<number, number>()
  for (const n of networks) if (n.channel != null) channelCounts.set(n.channel, (channelCounts.get(n.channel) ?? 0) + 1)
  const channels = Array.from(channelCounts.entries()).sort((a, b) => a[0] - b[0])
  const maxCh = Math.max(...channels.map(([, c]) => c), 1)

  return (
    <div>
      <PageHeader
        title="Wi-Fi Analyzer"
        subtitle="Signal strength, channels and nearby networks"
        actions={<Button icon={loading ? <Spinner size={14} /> : <RefreshCw size={15} />} onClick={load} disabled={loading}>Rescan</Button>}
      />

      <div className="grid grid-cols-12 gap-4">
        {info && !info.connected ? (
          <Card className="col-span-12 lg:col-span-5 p-6">
            <CardHeader title="Connection" action={<StatusDot state="idle" label="Not on Wi-Fi" />} />
            <div className="mt-5 flex items-start gap-4">
              <WifiOff size={28} className="text-ink-500 shrink-0 mt-0.5" />
              <p className="text-sm text-ink-300 leading-relaxed">
                This PC isn't connected to a wireless network right now — it's probably on Ethernet. Nearby
                networks and channel usage are still shown below.
              </p>
            </div>
          </Card>
        ) : (
          <Card className="col-span-12 lg:col-span-5 p-6">
            <CardHeader title="Connected Network" action={<StatusDot state="good" label="Connected" pulse />} />
            <div className="mt-5 flex items-center gap-6">
              <SignalRing pct={info?.signalPct ?? 0} />
              <div className="min-w-0">
                <div className="text-xl font-semibold text-ink-50 truncate selectable">{info?.ssid ?? '—'}</div>
                <div className="text-xs text-ink-500 font-mono mt-1 selectable">{info?.bssid ?? ''}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {info?.band && <Badge tone="outline">{info.band}</Badge>}
                  {info?.radioType && <Badge tone="outline">{info.radioType}</Badge>}
                  {info?.channel != null && <Badge tone="outline">ch {info.channel}</Badge>}
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4 pt-5 border-t border-white/[0.06]">
              <MiniStat label="Signal" value={info?.signalPct != null ? `${info.signalPct}%` : '—'} />
              <MiniStat label="Rx rate" value={info?.rxRateMbps != null ? `${info.rxRateMbps}` : '—'} unit="Mbps" />
              <MiniStat label="Tx rate" value={info?.txRateMbps != null ? `${info.txRateMbps}` : '—'} unit="Mbps" />
            </div>
          </Card>
        )}

          {/* Channel usage */}
          <Card className="col-span-12 lg:col-span-7 p-6">
            <CardHeader title="Channel Usage" action={<Badge tone="outline">{networks.length} networks</Badge>} />
            <div className="mt-5">
              {channels.length === 0 ? (
                <EmptyState title="No channel data" hint="Rescan to enumerate nearby access points." />
              ) : (
                <div className="flex items-end gap-2 h-36">
                  {channels.map(([ch, count]) => (
                    <div key={ch} className="flex-1 flex flex-col items-center gap-2 h-full justify-end min-w-0">
                      <span className="text-xs text-ink-200 tabular-nums">{count}</span>
                      <motion.div initial={{ height: 0 }} animate={{ height: `${(count / maxCh) * 100}%` }}
                        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.6 }}
                        className="w-full rounded-md bg-gradient-to-b from-ink-200 to-ink-600 min-h-[4px]" />
                      <span className="text-[0.5625rem] text-ink-500 tabular-nums">{ch}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Nearby networks */}
          <Card className="col-span-12 p-6">
            <CardHeader title="Nearby Networks" />
            <div className="mt-4">
              {loading && <EmptyState icon={<Spinner size={26} />} title="Scanning…" />}
              {!loading && networks.length === 0 && <EmptyState icon={<Wifi size={26} />} title="No networks found" />}
              <div className="space-y-1">
                {networks.map((n, i) => (
                  <motion.div key={(n.bssid ?? n.ssid) + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors selectable">
                    <SignalBars pct={n.signalPct ?? 0} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink-100 truncate">{n.ssid}</div>
                      <div className="text-xs text-ink-500 font-mono">{n.bssid ?? ''}</div>
                    </div>
                    {n.band && <Badge tone="outline">{n.band}</Badge>}
                    {n.channel != null && <span className="text-xs text-ink-500 w-12 text-right">ch {n.channel}</span>}
                    <span className="text-sm text-ink-200 tabular-nums w-12 text-right">{n.signalPct != null ? `${n.signalPct}%` : '—'}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </Card>
      </div>
    </div>
  )
}

function SignalRing({ pct }: { pct: number }): JSX.Element {
  const size = 96, stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ededee" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (pct / 100) * c }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Wifi size={28} className="text-ink-100" />
      </div>
    </div>
  )
}

function SignalBars({ pct }: { pct: number }): JSX.Element {
  const bars = 4
  const filled = Math.round((pct / 100) * bars)
  return (
    <div className="flex items-end gap-0.5 h-4 w-5 shrink-0">
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} className={`flex-1 rounded-sm ${i < filled ? 'bg-ink-100' : 'bg-ink-700'}`} style={{ height: `${((i + 1) / bars) * 100}%` }} />
      ))}
    </div>
  )
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit?: string }): JSX.Element {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 text-lg font-semibold text-ink-50 tabular-nums">
        {value}{unit && <span className="text-ink-400 text-xs font-medium ml-1">{unit}</span>}
      </div>
    </div>
  )
}
