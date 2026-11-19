import { useEffect, useRef, useState } from 'react'
import { Play, Square, Save, Trash2, Activity } from 'lucide-react'
import type { PingResult } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Stat, Field, Button, Badge, StatusDot, EmptyState } from '../components/ui'
import { LatencyChart, type LatencyPoint } from '../components/charts'
import { computePingStats } from '../lib/stats'
import { ms, pct, clockTime } from '../lib/format'
import { saveHistory } from '../lib/export'

const MAX_POINTS = 120

export function LivePing(): JSX.Element {
  const [host, setHost] = useState('1.1.1.1')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<PingResult[]>([])
  const sessionRef = useRef<{ stop: () => void } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const stats = computePingStats(results)
  const chartData: LatencyPoint[] = results.slice(-MAX_POINTS).map((r) => ({
    seq: r.seq,
    latency: r.success ? r.latencyMs : null
  }))

  const start = async (): Promise<void> => {
    if (!host.trim()) return
    setResults([])
    setRunning(true)
    sessionRef.current = await window.pingus.startPing(host.trim(), {
      onData: (p) => setResults((prev) => [...prev.slice(-(MAX_POINTS * 2)), p as PingResult])
    })
  }

  const stop = (): void => {
    sessionRef.current?.stop()
    sessionRef.current = null
    setRunning(false)
  }

  useEffect(() => () => sessionRef.current?.stop(), [])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [results.length])

  const save = async (): Promise<void> => {
    await saveHistory(
      'ping',
      `Ping ${host}`,
      host,
      `${stats.received}/${stats.sent} replies · avg ${ms(stats.avgMs, 1)}ms · ${pct(stats.lossPct, 1)} loss`,
      { host, stats, results: results.slice(-200) }
    )
  }

  return (
    <div>
      <PageHeader
        title="Live Ping"
        subtitle="Continuous latency, jitter and packet-loss monitoring"
        actions={
          <>
            <Button icon={<Save size={15} />} onClick={save} disabled={!results.length}>Save</Button>
            {running ? (
              <Button variant="danger" icon={<Square size={14} />} onClick={stop}>Stop</Button>
            ) : (
              <Button variant="primary" icon={<Play size={14} />} onClick={start}>Start</Button>
            )}
          </>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <Field
          className="max-w-sm flex-1"
          icon={<Activity size={15} />}
          placeholder="Host or IP (e.g. 1.1.1.1)"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !running && start()}
          disabled={running}
        />
        {running && <StatusDot state="good" label="Pinging" pulse />}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <StatTile className="col-span-6 md:col-span-3" value={ms(stats.avgMs, 1)} unit="ms" label="Avg Latency" />
        <StatTile className="col-span-6 md:col-span-3" value={ms(stats.minMs, 1)} unit="ms" label="Min" />
        <StatTile className="col-span-6 md:col-span-3" value={ms(stats.maxMs, 1)} unit="ms" label="Max" />
        <StatTile className="col-span-6 md:col-span-3" value={ms(stats.jitterMs, 1)} unit="ms" label="Jitter" />

        <Card className="col-span-12 lg:col-span-8 p-6">
          <CardHeader
            title="Latency Over Time"
            action={<Badge tone="outline">{chartData.length} pts</Badge>}
          />
          <div className="mt-4">
            {results.length ? (
              <LatencyChart data={chartData} />
            ) : (
              <EmptyState
                icon={<Activity size={28} />}
                title="No data yet"
                hint="Enter a host and press Start to begin continuous monitoring."
              />
            )}
          </div>
        </Card>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <Card className="p-6">
            <CardHeader title="Reliability" />
            <div className="mt-5 space-y-4">
              <Meter label="Received" value={stats.received} total={stats.sent || 1} />
              <Meter label="Lost" value={stats.lost} total={stats.sent || 1} invert />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-ink-400">Packet loss</span>
                <span className="text-lg font-semibold text-ink-50 tabular-nums">{pct(stats.lossPct, 1)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 flex-1 min-h-0">
            <CardHeader title="Replies" action={
              results.length ? (
                <button onClick={() => setResults([])} className="no-drag text-ink-500 hover:text-ink-200">
                  <Trash2 size={13} />
                </button>
              ) : undefined
            } />
            <div ref={listRef} className="mt-3 space-y-0.5 max-h-56 overflow-y-auto font-mono text-xs selectable">
              {results.slice(-80).map((r, i) => (
                <div key={r.seq + '-' + i} className="flex items-center justify-between px-2 py-1 rounded">
                  <span className="text-ink-500">{clockTime(r.timestamp)}</span>
                  {r.success ? (
                    <span className="text-ink-100 tabular-nums">{ms(r.latencyMs, 0)} ms {r.ttl ? `· ttl ${r.ttl}` : ''}</span>
                  ) : (
                    <span className="text-ink-500">{r.error ?? 'timeout'}</span>
                  )}
                </div>
              ))}
              {!results.length && <div className="text-ink-500 px-2 py-4">Awaiting replies…</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatTile({ value, unit, label, className = '' }: { value: string; unit?: string; label: string; className?: string }): JSX.Element {
  return (
    <Card className={`p-5 ${className}`}>
      <Stat value={value} unit={unit} label={label} size="md" />
    </Card>
  )
}

function Meter({ label, value, total, invert = false }: { label: string; value: number; total: number; invert?: boolean }): JSX.Element {
  const p = total ? (value / total) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-ink-300">{label}</span>
        <span className="text-sm text-ink-100 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${invert ? 'bg-ink-500' : 'bg-ink-100'}`}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  )
}
