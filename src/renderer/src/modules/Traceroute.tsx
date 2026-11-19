import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Square, Save, Route as RouteIcon, MapPin } from 'lucide-react'
import type { TracerouteHop } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Field, Button, Badge, StatusDot, EmptyState, Spinner } from '../components/ui'
import { ms } from '../lib/format'
import { saveHistory } from '../lib/export'

export function Traceroute(): JSX.Element {
  const [host, setHost] = useState('cloudflare.com')
  const [running, setRunning] = useState(false)
  const [hops, setHops] = useState<TracerouteHop[]>([])
  const sessionRef = useRef<{ stop: () => void } | null>(null)

  const maxLatency = Math.max(...hops.map((h) => h.avgMs ?? 0), 1)

  const start = async (): Promise<void> => {
    if (!host.trim()) return
    setHops([])
    setRunning(true)
    sessionRef.current = await window.pingus.startTrace(host.trim(), {
      onData: (h) => setHops((prev) => [...prev, h as TracerouteHop]),
      onDone: () => setRunning(false),
      onError: () => setRunning(false)
    })
  }
  const stop = (): void => {
    sessionRef.current?.stop()
    setRunning(false)
  }
  useEffect(() => () => sessionRef.current?.stop(), [])

  const save = async (): Promise<void> => {
    await saveHistory('traceroute', `Traceroute ${host}`, host, `${hops.length} hops`, { host, hops })
  }

  return (
    <div>
      <PageHeader
        title="Traceroute"
        subtitle="Visualize the network path and per-hop latency"
        actions={
          <>
            <Button icon={<Save size={15} />} onClick={save} disabled={!hops.length}>Save</Button>
            {running ? (
              <Button variant="danger" icon={<Square size={14} />} onClick={stop}>Stop</Button>
            ) : (
              <Button variant="primary" icon={<Play size={14} />} onClick={start}>Trace</Button>
            )}
          </>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <Field
          className="max-w-sm flex-1"
          icon={<RouteIcon size={15} />}
          placeholder="Destination host or IP"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !running && start()}
          disabled={running}
        />
        {running && <StatusDot state="good" label="Tracing" pulse />}
      </div>

      <Card className="p-6">
        <CardHeader
          title="Route"
          action={
            <div className="flex items-center gap-2">
              {running && <Spinner size={14} />}
              <Badge tone="outline">{hops.length} hops</Badge>
            </div>
          }
        />
        <div className="mt-5">
          {hops.length === 0 && !running && (
            <EmptyState icon={<RouteIcon size={28} />} title="No route traced" hint="Enter a destination and press Trace to map the path." />
          )}
          {hops.length === 0 && running && (
            <EmptyState icon={<Spinner size={28} />} title="Discovering hops…" />
          )}
          <div className="space-y-1.5">
            {hops.map((hop, i) => {
              const timedOut = hop.avgMs == null
              const barW = timedOut ? 0 : ((hop.avgMs as number) / maxLatency) * 100
              return (
                <motion.div
                  key={hop.hop}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  className="flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors selectable"
                >
                  <span className="w-7 text-xs font-mono text-ink-500 tabular-nums shrink-0">{hop.hop}</span>
                  <MapPin size={13} className={timedOut ? 'text-ink-700' : 'text-ink-400'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink-100 truncate">
                      {hop.host || hop.ip || <span className="text-ink-500 italic">Request timed out</span>}
                    </div>
                    {hop.host && hop.ip && <div className="text-xs text-ink-500 font-mono">{hop.ip}</div>}
                  </div>
                  <div className="w-32 hidden md:block">
                    <div className="h-1 rounded-full bg-ink-700 overflow-hidden">
                      <div className="h-full bg-ink-200 rounded-full transition-all duration-500" style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                  <span className="w-16 text-right text-sm font-semibold text-ink-100 tabular-nums shrink-0">
                    {timedOut ? '—' : `${ms(hop.avgMs, 0)}ms`}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}
