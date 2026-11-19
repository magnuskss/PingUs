import { useEffect, useRef, useState } from 'react'
import { PackageSearch, Play, Square, Save, Trash2, Download, AlertTriangle } from 'lucide-react'
import type { ToolAvailability } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Stat, Field, Button, Badge, EmptyState, StatusDot, Select } from '../components/ui'
import { saveHistory, toCsv, downloadText } from '../lib/export'

interface PacketRow {
  no: number; time: string; src: string; dst: string; protocol: string; length: number; info: string
}
interface Iface { id: string; name: string }

const MAX_ROWS = 500

export function PacketAnalyzer(): JSX.Element {
  const [tools, setTools] = useState<ToolAvailability>({ nmap: false, tshark: false })
  const [ifaces, setIfaces] = useState<Iface[]>([])
  const [iface, setIface] = useState('')
  const [filter, setFilter] = useState('')
  const [running, setRunning] = useState(false)
  const [packets, setPackets] = useState<PacketRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<{ stop: () => void } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.pingus.detectTools().then(async (t) => {
      setTools(t)
      if (t.tshark) {
        const list = await window.pingus.captureInterfaces()
        setIfaces(list)
        if (list.length) setIface(list[0].id)
      }
    })
    return () => sessionRef.current?.stop()
  }, [])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [packets.length])

  const start = async (): Promise<void> => {
    if (!iface) return
    setPackets([]); setError(null); setRunning(true)
    sessionRef.current = await window.pingus.startCapture(iface, filter.trim() || null, {
      onData: (p) => setPackets((prev) => [...prev.slice(-(MAX_ROWS - 1)), p as PacketRow]),
      onError: (msg) => { setError(String(msg)); setRunning(false) }
    })
  }
  const stop = async (): Promise<void> => {
    sessionRef.current?.stop()
    setRunning(false)
    setPackets((p) => {
      if (p.length) saveHistory('packets', 'Packet Capture', iface, `${p.length} packets captured`, p.slice(-MAX_ROWS))
      return p
    })
  }

  const exportCsv = (): void => {
    downloadText(`pingus-capture-${Date.now()}.csv`, toCsv(packets as unknown as Record<string, unknown>[]), 'text/csv')
  }

  // Protocol distribution
  const protoCounts = new Map<string, number>()
  for (const p of packets) protoCounts.set(p.protocol, (protoCounts.get(p.protocol) ?? 0) + 1)
  const topProtos = Array.from(protoCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const totalBytes = packets.reduce((a, p) => a + p.length, 0)

  if (!tools.tshark) {
    return (
      <div>
        <PageHeader title="Packet Analyzer" subtitle="Live traffic inspection with Wireshark / TShark" />
        <Card className="p-8">
          <EmptyState
            icon={<PackageSearch size={32} />}
            title="TShark not detected"
            hint="The Packet Analyzer uses TShark (the Wireshark command-line engine) to capture live traffic. Install Wireshark, then set the tshark path in Settings and reopen this page."
          />
          <div className="mt-4 flex justify-center">
            <Button onClick={() => window.pingus.detectTools().then(setTools)}>Re-check for TShark</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Packet Analyzer"
        subtitle="Live traffic capture and inspection via TShark"
        actions={
          <>
            <Button icon={<Download size={15} />} onClick={exportCsv} disabled={!packets.length}>Export</Button>
            {running ? (
              <Button variant="danger" icon={<Square size={14} />} onClick={stop}>Stop</Button>
            ) : (
              <Button variant="primary" icon={<Play size={14} />} onClick={start} disabled={!iface}>Capture</Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-ink-850 border border-white/[0.06]">
        <AlertTriangle size={15} className="text-ink-400 shrink-0" />
        <span className="text-xs text-ink-400">Capture only traffic on networks you are authorized to monitor. Requires Npcap and may need elevated privileges.</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select value={iface} onChange={setIface} options={ifaces.map((i) => ({ value: i.id, label: i.name }))} className="min-w-[200px]" />
        <Field className="w-64" placeholder="Capture filter (e.g. tcp port 443)" value={filter} onChange={(e) => setFilter(e.target.value)} disabled={running} />
        {running && <StatusDot state="good" label="Capturing" pulse />}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-ink-850 border border-white/[0.08] text-sm text-ink-300">{error}</div>
      )}

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-6 md:col-span-3 p-5"><Stat value={String(packets.length)} label="Packets" /></Card>
        <Card className="col-span-6 md:col-span-3 p-5"><Stat value={(totalBytes / 1024).toFixed(1)} unit="KB" label="Captured" /></Card>
        <Card className="col-span-12 md:col-span-6 p-5">
          <CardHeader title="Top Protocols" />
          <div className="mt-3 flex flex-wrap gap-2">
            {topProtos.length ? topProtos.map(([p, c]) => (
              <Badge key={p} tone="outline">{p} · {c}</Badge>
            )) : <span className="text-xs text-ink-500">No packets yet</span>}
          </div>
        </Card>

        <Card className="col-span-12 p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-3">
            <CardHeader title="Live Packets" action={
              packets.length ? <button onClick={() => setPackets([])} className="no-drag text-ink-500 hover:text-ink-200"><Trash2 size={14} /></button> : undefined
            } />
          </div>
          <div className="grid grid-cols-[60px_80px_1.4fr_1.4fr_90px_70px_2fr] px-6 py-2 bg-ink-850 label text-[0.5625rem] border-y border-white/[0.05]">
            <span>No.</span><span>Time</span><span>Source</span><span>Destination</span><span>Proto</span><span>Len</span><span>Info</span>
          </div>
          <div ref={listRef} className="max-h-[420px] overflow-y-auto font-mono text-xs selectable">
            {packets.length === 0 && (
              <div className="py-12"><EmptyState icon={<PackageSearch size={26} />} title={running ? 'Waiting for packets…' : 'No capture running'} hint={running ? undefined : 'Select an interface and press Capture.'} /></div>
            )}
            {packets.map((p, i) => (
              <div key={p.no + '-' + i} className="grid grid-cols-[60px_80px_1.4fr_1.4fr_90px_70px_2fr] px-6 py-1.5 items-center hover:bg-white/[0.02] border-b border-white/[0.02]">
                <span className="text-ink-500 tabular-nums">{p.no}</span>
                <span className="text-ink-500 tabular-nums">{Number(p.time).toFixed(2)}</span>
                <span className="text-ink-200 truncate">{p.src || '—'}</span>
                <span className="text-ink-200 truncate">{p.dst || '—'}</span>
                <span className="text-ink-100">{p.protocol}</span>
                <span className="text-ink-400 tabular-nums">{p.length}</span>
                <span className="text-ink-400 truncate">{p.info}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
