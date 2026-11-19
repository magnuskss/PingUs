import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { History as HistoryIcon, Trash2, Download, Search } from 'lucide-react'
import type { HistoryRecord, ModuleId } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Button, Badge, EmptyState, Select } from '../components/ui'
import { NAV } from '../lib/nav'
import { dateTime } from '../lib/format'
import { downloadText } from '../lib/export'

export function HistoryView(): JSX.Element {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [filter, setFilter] = useState<'all' | ModuleId>('all')
  const [selected, setSelected] = useState<HistoryRecord | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    setLoading(true)
    const list = await window.pingus.historyList(filter === 'all' ? {} : { module: filter })
    setRecords(list)
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])

  const remove = async (id: number): Promise<void> => {
    await window.pingus.historyRemove(id)
    if (selected?.id === id) setSelected(null)
    load()
  }
  const clearAll = async (): Promise<void> => {
    await window.pingus.historyClear()
    setSelected(null)
    load()
  }
  const exportOne = (rec: HistoryRecord): void => {
    downloadText(`pingus-${rec.module}-${rec.id}.json`, JSON.stringify({ ...rec, data: JSON.parse(rec.data) }, null, 2), 'application/json')
  }
  const exportAll = (): void => {
    downloadText(`pingus-history-${Date.now()}.json`, JSON.stringify(records.map((r) => ({ ...r, data: JSON.parse(r.data) })), null, 2), 'application/json')
  }

  const moduleLabel = (id: ModuleId): string => NAV.find((n) => n.id === id)?.label ?? id

  return (
    <div>
      <PageHeader
        title="History"
        subtitle="Saved scans, monitoring sessions and exportable reports"
        actions={
          <>
            <Button icon={<Download size={15} />} onClick={exportAll} disabled={!records.length}>Export All</Button>
            <Button variant="danger" icon={<Trash2 size={14} />} onClick={clearAll} disabled={!records.length}>Clear</Button>
          </>
        }
      />

      <div className="flex items-center gap-3 mb-5">
        <Select
          value={filter}
          onChange={(v) => setFilter(v as 'all' | ModuleId)}
          options={[{ value: 'all', label: 'All modules' }, ...NAV.filter((n) => n.id !== 'history' && n.id !== 'settings').map((n) => ({ value: n.id, label: n.label }))]}
        />
        <Badge tone="outline">{records.length} records</Badge>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-7 p-0 overflow-hidden">
          <div className="p-6 pb-3"><CardHeader title="Saved Records" /></div>
          <div className="max-h-[520px] overflow-y-auto">
            {loading && <div className="p-6"><EmptyState icon={<Search size={26} />} title="Loading…" /></div>}
            {!loading && records.length === 0 && (
              <div className="p-6"><EmptyState icon={<HistoryIcon size={28} />} title="No history yet" hint="Scans and tests you run are saved here automatically." /></div>
            )}
            <div className="divide-y divide-white/[0.04]">
              {records.map((rec, i) => (
                <motion.button
                  key={rec.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  onClick={() => setSelected(rec)}
                  className={`no-drag w-full text-left px-6 py-3.5 transition-colors ${selected?.id === rec.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge>{moduleLabel(rec.module)}</Badge>
                      <span className="text-sm text-ink-100 truncate">{rec.title}</span>
                    </div>
                    <span className="text-xs text-ink-500 shrink-0">{dateTime(rec.createdAt)}</span>
                  </div>
                  <div className="text-xs text-ink-400 mt-1.5 truncate">{rec.summary}</div>
                </motion.button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-5 p-6">
          <CardHeader title="Detail" action={
            selected && (
              <div className="flex items-center gap-2">
                <button onClick={() => exportOne(selected)} className="no-drag text-ink-500 hover:text-ink-200"><Download size={14} /></button>
                <button onClick={() => remove(selected.id)} className="no-drag text-ink-500 hover:text-ink-200"><Trash2 size={14} /></button>
              </div>
            )
          } />
          {!selected ? (
            <EmptyState icon={<HistoryIcon size={26} />} title="Select a record" hint="Choose a saved scan to view its full data." />
          ) : (
            <div className="mt-4 selectable">
              <div className="space-y-2 mb-4">
                <DetailRow label="Module" value={moduleLabel(selected.module)} />
                <DetailRow label="Target" value={selected.target ?? '—'} />
                <DetailRow label="When" value={dateTime(selected.createdAt)} />
                <DetailRow label="Summary" value={selected.summary} />
              </div>
              <pre className="max-h-72 overflow-auto rounded-xl bg-ink-900 border border-white/[0.05] p-4 text-xs text-ink-300 font-mono whitespace-pre-wrap">
                {JSON.stringify(JSON.parse(selected.data), null, 2)}
              </pre>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-ink-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-ink-100 text-right truncate max-w-[220px]">{value}</span>
    </div>
  )
}
