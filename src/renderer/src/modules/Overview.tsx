import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Globe2, Router, Server, Network, Copy, Check } from 'lucide-react'
import type { OverviewSnapshot } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Label, Button, Badge, Skeleton } from '../components/ui'
import { RouteMap } from '../components/RouteMap'
import { LatencyChart } from '../components/charts'
import { ms } from '../lib/format'
import { copyToClipboard as copyClip } from '../lib/export'

export function Overview(): JSX.Element {
  const [data, setData] = useState<OverviewSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<{ seq: number; latency: number | null }[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval>>()
  const seq = useRef(0)

  const load = async (): Promise<void> => {
    const snap = await window.pingus.getOverview()
    setData(snap)
    setLoading(false)
    setHistory((h) => [...h.slice(-59), { seq: seq.current++, latency: snap.internetLatencyMs }])
  }

  useEffect(() => {
    load()
    timer.current = setInterval(load, 5000)
    return () => clearInterval(timer.current)
  }, [])

  const copy = async (text: string, key: string): Promise<void> => {
    await copyClip(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1200)
  }

  const primary = data?.primaryInterface
  const activeIfaces = data?.interfaces.filter((i) => !i.internal && i.family === 'IPv4') ?? []

  const verdict = loading
    ? 'Checking your connection…'
    : data?.online
      ? `Online — reaching the internet in ${ms(data.internetLatencyMs)} ms`
      : 'Offline — no route to the internet'

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="A live read on your connection — reachability, addressing and the path your traffic takes."
        actions={<Button icon={<RefreshCw size={15} />} onClick={load}>Refresh</Button>}
      />

      <div className="grid grid-cols-12 gap-4 auto-rows-min">
        {/* Connection + live latency — the hero */}
        <Card className="col-span-12 lg:col-span-8 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  loading ? 'bg-ink-500' : data?.online ? 'bg-good shadow-[0_0_10px_rgba(62,224,143,0.7)] pulse-dot' : 'bg-bad'
                }`}
              />
              <span className="text-base font-medium text-ink-50">{verdict}</span>
            </div>
            <Badge tone="outline">1.1.1.1 · 5s</Badge>
          </div>

          <div className="mt-6 flex items-end gap-8">
            <div>
              <Label>Internet</Label>
              <div className="text-hero font-semibold text-ink-50 tabular-nums mt-1.5 leading-none">
                {ms(data?.internetLatencyMs ?? null)}<span className="text-ink-400 text-base font-medium ml-1.5">ms</span>
              </div>
            </div>
            <div className="pb-1">
              <Label>Gateway</Label>
              <div className="text-xl font-semibold text-ink-150 tabular-nums mt-1 leading-none">
                {ms(data?.gatewayLatencyMs ?? null)}<span className="text-ink-500 text-xs ml-1">ms</span>
              </div>
            </div>
            <div className="pb-1">
              <Label>Samples</Label>
              <div className="text-xl font-semibold text-ink-150 tabular-nums mt-1 leading-none">{history.length}</div>
            </div>
          </div>

          <div className="mt-5 -mx-1">
            <LatencyChart data={history} height={190} />
          </div>
        </Card>

        {/* Live route: this PC → gateway → internet */}
        <Card className="col-span-12 lg:col-span-4 p-6" raised>
          <CardHeader
            title="Signal Path"
            action={<span className={`font-mono text-[0.625rem] uppercase tracking-[0.16em] ${data?.online ? 'text-good' : 'text-ink-500'}`}>{loading ? 'tracing' : data?.online ? 'live' : 'down'}</span>}
          />
          <div className="mt-5">
            <RouteMap
              host={data?.hostname ?? null}
              localIp={primary?.address ?? null}
              gateway={data?.gateway ?? null}
              publicIp={data?.publicIp ?? null}
              gatewayMs={data?.gatewayLatencyMs ?? null}
              internetMs={data?.internetLatencyMs ?? null}
              online={!!data?.online}
              loading={loading}
            />
          </div>
        </Card>

        {/* Addressing */}
        <Card className="col-span-12 lg:col-span-7 p-6">
          <CardHeader title="Addressing" />
          <div className="mt-4 divide-y divide-[var(--hair)]">
            <AddressRow icon={<Globe2 size={15} />} label="Public IP" value={data?.publicIp ?? (loading ? null : 'Unavailable')}
              loading={loading} onCopy={() => data?.publicIp && copy(data.publicIp, 'pub')} copied={copied === 'pub'} />
            <AddressRow icon={<Network size={15} />} label="Local IP" value={primary?.address ?? (loading ? null : '—')}
              sub={primary?.cidr ?? undefined} loading={loading}
              onCopy={() => primary?.address && copy(primary.address, 'loc')} copied={copied === 'loc'} />
            <AddressRow icon={<Router size={15} />} label="Default gateway" value={data?.gateway ?? (loading ? null : '—')}
              loading={loading} onCopy={() => data?.gateway && copy(data.gateway, 'gw')} copied={copied === 'gw'} />
            <AddressRow icon={<Server size={15} />} label="DNS server" value={data?.dnsServers[0] ?? (loading ? null : '—')}
              sub={data && data.dnsServers.length > 1 ? `+${data.dnsServers.length - 1} more` : undefined}
              loading={loading} onCopy={() => data?.dnsServers[0] && copy(data.dnsServers[0], 'dns')} copied={copied === 'dns'} />
          </div>
        </Card>

        {/* System + interfaces */}
        <Card className="col-span-12 lg:col-span-5 p-6">
          <CardHeader title="System" action={<Badge>{activeIfaces.length} active</Badge>} />
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
            <Meta label="Host" value={data?.hostname ?? '—'} />
            <Meta label="Platform" value={data?.platform ?? '—'} />
          </div>
          <div className="rule-fade my-4" />
          <div className="space-y-1">
            {loading ? (
              <><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></>
            ) : activeIfaces.length ? (
              activeIfaces.map((iface, i) => (
                <motion.div
                  key={iface.name + iface.address}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between py-2 selectable"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-good shrink-0" />
                    <span className="text-sm text-ink-150 truncate max-w-[150px]">{iface.name}</span>
                  </div>
                  <span className="text-sm text-ink-100 font-mono text-[0.8125rem] tabular-nums">{iface.address}</span>
                </motion.div>
              ))
            ) : (
              <div className="text-sm text-ink-400 py-3">No active interfaces detected.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function AddressRow({
  icon, label, value, sub, loading, onCopy, copied
}: {
  icon: JSX.Element; label: string; value: string | null; sub?: string
  loading: boolean; onCopy: () => void; copied: boolean
}): JSX.Element {
  const empty = !value || value === '—' || value === 'Unavailable'
  return (
    <div className="flex items-center justify-between gap-4 py-3 group">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-ink-500">{icon}</span>
        <span className="text-sm text-ink-400">{label}</span>
      </div>
      <div className="flex items-center gap-3 min-w-0">
        {loading ? (
          <Skeleton className="h-4 w-28" />
        ) : (
          <div className="text-right min-w-0">
            <div className="text-sm text-ink-50 font-mono text-[0.8125rem] tabular-nums truncate selectable">{value}</div>
            {sub && <div className="text-[0.625rem] text-ink-500">{sub}</div>}
          </div>
        )}
        <button
          onClick={onCopy}
          disabled={empty}
          className="no-drag text-ink-600 hover:text-accent transition-colors disabled:opacity-0 shrink-0"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={13} className="text-good" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className="text-sm text-ink-100 mt-1 truncate selectable">{value}</div>
    </div>
  )
}
