import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ScanLine, Play, Square, Save, ShieldCheck } from 'lucide-react'
import type { PortResult, ToolAvailability } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Stat, Field, Button, Badge, ProgressBar, EmptyState, StatusDot, Select } from '../components/ui'
import { saveHistory } from '../lib/export'

type Preset = 'common' | 'top1000' | 'web' | 'custom'

export function PortScanner(): JSX.Element {
  const [host, setHost] = useState('127.0.0.1')
  const [preset, setPreset] = useState<Preset>('common')
  const [customRange, setCustomRange] = useState('1-1024')
  const [running, setRunning] = useState(false)
  const [openPorts, setOpenPorts] = useState<PortResult[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [tools, setTools] = useState<ToolAvailability>({ nmap: false, tshark: false })
  const [useNmap, setUseNmap] = useState(false)
  const [nmapRaw, setNmapRaw] = useState('')
  const sessionRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    window.pingus.detectTools().then(setTools)
    return () => sessionRef.current?.stop()
  }, [])

  const buildPorts = async (): Promise<number[]> => {
    if (preset === 'common') return window.pingus.commonPorts()
    if (preset === 'web') return [80, 443, 8080, 8443, 8000, 3000, 5000]
    if (preset === 'top1000') return Array.from({ length: 1024 }, (_, i) => i + 1)
    // custom range a-b or list
    const ports = new Set<number>()
    for (const part of customRange.split(',')) {
      const m = part.trim().match(/^(\d+)(?:-(\d+))?$/)
      if (!m) continue
      const a = Number(m[1]); const b = m[2] ? Number(m[2]) : a
      for (let p = Math.max(1, a); p <= Math.min(65535, b); p++) ports.add(p)
    }
    return Array.from(ports)
  }

  const start = async (): Promise<void> => {
    if (!host.trim()) return
    setOpenPorts([]); setNmapRaw('')
    setRunning(true)

    if (useNmap && tools.nmap) {
      const spec = preset === 'custom' ? customRange : preset === 'web' ? '80,443,8080,8443' : preset === 'top1000' ? '1-1024' : '1-1024'
      const res = await window.pingus.nmapScan(host.trim(), spec)
      setOpenPorts(res.results.filter((r) => r.state === 'open'))
      setNmapRaw(res.raw || res.error || '')
      setRunning(false)
      await saveHistory('ports', `Nmap ${host}`, host, `${res.results.filter((r) => r.state === 'open').length} open ports`, res)
      return
    }

    const ports = await buildPorts()
    setProgress({ done: 0, total: ports.length })
    sessionRef.current = await window.pingus.startPortScan(host.trim(), ports, {
      onData: (r) => setOpenPorts((prev) => [...prev, r as PortResult].sort((a, b) => a.port - b.port)),
      onProgress: (p) => setProgress(p as { done: number; total: number }),
      onDone: () => {
        setRunning(false)
        setOpenPorts((o) => {
          saveHistory('ports', `Scan ${host}`, host, `${o.length} open ports`, { host, openPorts: o })
          return o
        })
      },
      onError: () => setRunning(false)
    })
  }
  const stop = (): void => { sessionRef.current?.stop(); setRunning(false) }

  const pctDone = progress.total ? (progress.done / progress.total) * 100 : 0

  return (
    <div>
      <PageHeader
        title="Port Scanner"
        subtitle="TCP connect scan with optional Nmap service detection"
        actions={
          running ? (
            <Button variant="danger" icon={<Square size={14} />} onClick={stop}>Stop</Button>
          ) : (
            <Button variant="primary" icon={<Play size={14} />} onClick={start}>Scan</Button>
          )
        }
      />

      {/* Authorization notice */}
      <div className="mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-ink-850 border border-white/[0.06]">
        <ShieldCheck size={15} className="text-ink-400 shrink-0" />
        <span className="text-xs text-ink-400">Scan only hosts and networks you own or are explicitly authorized to test.</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Field className="w-64" icon={<ScanLine size={15} />} placeholder="Target host or IP" value={host}
          onChange={(e) => setHost(e.target.value)} disabled={running} />
        <Select
          value={preset}
          onChange={(v) => setPreset(v as Preset)}
          options={[
            { value: 'common', label: 'Common services' },
            { value: 'web', label: 'Web ports' },
            { value: 'top1000', label: 'Ports 1–1024' },
            { value: 'custom', label: 'Custom range' }
          ]}
        />
        {preset === 'custom' && (
          <Field className="w-44" placeholder="e.g. 20-25,80,443" value={customRange} onChange={(e) => setCustomRange(e.target.value)} disabled={running} />
        )}
        <button
          onClick={() => tools.nmap && setUseNmap((v) => !v)}
          disabled={!tools.nmap}
          className={`no-drag h-10 px-3 rounded-xl text-sm border transition-colors ${
            useNmap && tools.nmap ? 'bg-white/[0.08] text-ink-50 border-white/15' : 'bg-ink-850 text-ink-300 border-white/[0.07]'
          } ${!tools.nmap ? 'opacity-40' : 'hover:border-white/15'}`}
          title={tools.nmap ? 'Toggle Nmap engine' : 'Nmap not detected'}
        >
          Nmap {tools.nmap ? (useNmap ? 'on' : 'off') : 'n/a'}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-6 md:col-span-3 p-5"><Stat value={String(openPorts.length)} label="Open Ports" /></Card>
        <Card className="col-span-6 md:col-span-3 p-5"><Stat value={host || '—'} label="Target" size="sm" /></Card>
        <Card className="col-span-12 md:col-span-6 p-5 flex flex-col justify-between">
          <StatusDot state={running ? 'good' : 'idle'} label={running ? (useNmap ? 'Nmap scanning' : 'Scanning') : 'Idle'} pulse={running} />
          <div className="mt-3">
            <ProgressBar pct={useNmap && running ? 50 : pctDone} />
            {!useNmap && <div className="mt-1.5 text-xs text-ink-500 tabular-nums">{progress.done}/{progress.total} ports</div>}
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-7 p-6">
          <CardHeader title="Open Ports" action={<Badge tone="outline">TCP</Badge>} />
          <div className="mt-4">
            {!openPorts.length && !running && (
              <EmptyState icon={<ScanLine size={28} />} title="No open ports yet" hint="Choose a target and range, then press Scan." />
            )}
            {!openPorts.length && running && <EmptyState icon={<ScanLine size={28} className="animate-pulse" />} title="Scanning ports…" />}
            <div className="space-y-1.5">
              {openPorts.map((p, i) => (
                <motion.div key={p.port} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-ink-850 border border-white/[0.05] selectable">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-ink-100" />
                    <span className="font-mono text-sm text-ink-50 tabular-nums w-14">{p.port}</span>
                    <span className="text-sm text-ink-300">{p.service ?? 'unknown'}</span>
                  </div>
                  <Badge tone="outline">open{p.latencyMs != null ? ` · ${p.latencyMs}ms` : ''}</Badge>
                </motion.div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-5 p-6">
          <CardHeader title="Engine" />
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-400">Built-in TCP scanner</span>
              <StatusDot state="good" label="Ready" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-400">Nmap integration</span>
              <StatusDot state={tools.nmap ? 'good' : 'bad'} label={tools.nmap ? 'Detected' : 'Not found'} />
            </div>
            {!tools.nmap && (
              <p className="text-xs text-ink-500 leading-relaxed pt-1">
                Install Nmap and set its path in Settings for service/version detection (-sV). The built-in
                scanner works without it.
              </p>
            )}
            {nmapRaw && (
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-ink-900 border border-white/[0.05] p-3 text-xs text-ink-300 font-mono whitespace-pre-wrap selectable">
                {nmapRaw}
              </pre>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
