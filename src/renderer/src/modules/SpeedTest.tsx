import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gauge, Play, Square, Download, Upload, Activity, AlertTriangle, RotateCcw } from 'lucide-react'
import type { SpeedTestProgress } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Label, Button, Badge, ProgressBar } from '../components/ui'
import { SpeedDial, SpeedTrace, type DialMode } from '../components/SpeedDial'
import { mbps, ms } from '../lib/format'
import { saveHistory } from '../lib/export'

// Mirrors the main-process test lengths, so the trace's time axis matches.
const DOWN_MS = 10_000
const UP_MS = 8_000

type Sample = { t: number; v: number }

export function SpeedTest(): JSX.Element {
  const [state, setState] = useState<SpeedTestProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [down, setDown] = useState<Sample[]>([])
  const [up, setUp] = useState<Sample[]>([])
  const sessionRef = useRef<{ stop: () => void } | null>(null)
  const phaseStart = useRef<{ phase: string; at: number }>({ phase: '', at: 0 })

  const onProgress = (p: SpeedTestProgress): void => {
    setState(p)
    const now = performance.now()
    if (phaseStart.current.phase !== p.phase) phaseStart.current = { phase: p.phase, at: now }
    const t = now - phaseStart.current.at
    if (p.phase === 'download' && p.downloadMbps != null) setDown((d) => [...d, { t, v: p.downloadMbps! }])
    if (p.phase === 'upload' && p.uploadMbps != null) setUp((u) => [...u, { t, v: p.uploadMbps! }])
  }

  const start = async (): Promise<void> => {
    setError(null)
    setDown([])
    setUp([])
    phaseStart.current = { phase: '', at: 0 }
    setState({ phase: 'latency', downloadMbps: null, uploadMbps: null, pingMs: null, jitterMs: null, progressPct: 0 })
    setRunning(true)
    sessionRef.current = await window.pingus.startSpeedTest({
      onProgress: (p) => onProgress(p as SpeedTestProgress),
      onDone: async (p) => {
        const fin = p as SpeedTestProgress
        setState(fin)
        setRunning(false)
        await saveHistory('speedtest', 'Speed Test', 'speed.cloudflare.com',
          `↓ ${mbps(fin.downloadMbps)} ↑ ${mbps(fin.uploadMbps)} Mbps · ${ms(fin.pingMs, 0)}ms`, fin)
      },
      onError: (msg) => {
        setRunning(false)
        setError(typeof msg === 'string' ? msg : 'The speed test failed.')
      }
    })
  }
  const stop = (): void => {
    sessionRef.current?.stop()
    setRunning(false)
    setState((s) => (s ? { ...s, phase: 'done' } : s))
  }
  useEffect(() => () => sessionRef.current?.stop(), [])

  const phase = state?.phase
  const mode: DialMode = error ? 'error' : !state ? 'idle' : (phase as DialMode)
  const dialValue = phase === 'upload' ? state?.uploadMbps ?? null : state?.downloadMbps ?? null
  const caption = error
    ? 'Test failed'
    : !state
      ? 'Ready'
      : { latency: 'Measuring ping', download: 'Downloading', upload: 'Uploading', done: 'Download · final' }[state.phase]

  return (
    <div>
      <PageHeader
        title="Speed Test"
        subtitle="Download, upload, ping and jitter, measured against Cloudflare"
        actions={
          running ? (
            <Button variant="danger" icon={<Square size={14} />} onClick={stop}>Stop</Button>
          ) : (
            <Button variant="primary" icon={state ? <RotateCcw size={14} /> : <Play size={14} />} onClick={start}>
              {state ? 'Run again' : 'Run Test'}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-8 p-6" raised>
          <div className="flex items-center justify-between">
            <CardHeader title="Throughput" />
            {state && !error && <Badge tone={running ? 'solid' : 'outline'}>{running ? `${state.progressPct}%` : 'Complete'}</Badge>}
          </div>

          <div className="mt-4">
            <SpeedDial value={dialValue} mode={mode} caption={caption} />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-5 flex items-start gap-3 border border-bad/40 bg-bad/[0.06] px-4 py-3"
              >
                <AlertTriangle size={16} className="text-bad shrink-0 mt-0.5" />
                <p className="text-sm text-ink-150 leading-relaxed">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-ink-500">
              <span>Download</span>
              <span>Upload</span>
            </div>
            <SpeedTrace down={down} up={up} downMs={DOWN_MS} upMs={UP_MS} />
            <ProgressBar pct={state?.progressPct ?? 0} className="mt-3" />
          </div>
        </Card>

        <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4 content-start">
          <ResultStat icon={<Download size={15} />} label="Download" value={mbps(state?.downloadMbps ?? null)} unit="Mbps"
            active={running && phase === 'download'} />
          <ResultStat icon={<Upload size={15} />} label="Upload" value={mbps(state?.uploadMbps ?? null)} unit="Mbps"
            active={running && phase === 'upload'} />
          <ResultStat icon={<Activity size={15} />} label="Ping" value={ms(state?.pingMs ?? null, 1)} unit="ms"
            active={running && phase === 'latency'} sub={state?.jitterMs != null ? `jitter ${ms(state.jitterMs, 1)} ms` : undefined} />
          <Card className="p-5">
            <div className="flex items-center gap-2 text-ink-500">
              <Gauge size={14} />
              <Label>How it measures</Label>
            </div>
            <p className="mt-3 text-xs text-ink-400 leading-relaxed">
              12 parallel downloads for 10 s and 6 uploads for 8 s over kept-alive connections; the first
              2 s are ignored while the connection ramps up. Ping is the time to first byte on a warm connection.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ResultStat({
  icon, label, value, unit, active, sub
}: { icon: JSX.Element; label: string; value: string; unit: string; active?: boolean; sub?: string }): JSX.Element {
  return (
    <Card className={`p-5 transition-colors duration-300 ${active ? 'border-white/40' : ''}`}>
      <div className="flex items-center gap-2 text-ink-400">
        {icon}
        <Label>{label}</Label>
        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-ink-50 pulse-dot" />}
      </div>
      <div className="mt-2 text-3xl font-semibold text-ink-50 tabular-nums">
        {value}<span className="text-ink-400 text-sm font-medium ml-1">{unit}</span>
      </div>
      {sub && <div className="mt-1 font-mono text-[0.625rem] text-ink-500 tabular-nums">{sub}</div>}
    </Card>
  )
}
