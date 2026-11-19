import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, Search, Save, Copy, Check } from 'lucide-react'
import type { DnsLookupResult, DnsRecordType } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Field, Button, Badge, EmptyState, Spinner } from '../components/ui'
import { saveHistory, copyToClipboard } from '../lib/export'

const TYPES: DnsRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'PTR']

export function DnsAnalyzer(): JSX.Element {
  const [host, setHost] = useState('cloudflare.com')
  const [results, setResults] = useState<Record<string, DnsLookupResult>>({})
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState<DnsRecordType>('A')
  const [copied, setCopied] = useState(false)

  const lookupAll = async (): Promise<void> => {
    if (!host.trim()) return
    setLoading(true)
    setResults({})
    const entries = await Promise.all(
      TYPES.map(async (t) => [t, await window.pingus.dnsLookup(host.trim(), t)] as const)
    )
    const map: Record<string, DnsLookupResult> = {}
    for (const [t, r] of entries) map[t] = r
    setResults(map)
    setLoading(false)
    const total = entries.reduce((n, [, r]) => n + r.records.length, 0)
    await saveHistory('dns', `DNS ${host}`, host, `${total} records across ${TYPES.length} types`, { host, results: map })
  }

  const current = results[active]

  const copyCurrent = async (): Promise<void> => {
    if (!current) return
    await copyToClipboard(current.records.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div>
      <PageHeader title="DNS Analyzer" subtitle="Resolve records, reverse lookups and propagation details" />

      <div className="flex items-center gap-3 mb-5">
        <Field
          className="max-w-md flex-1"
          icon={<Globe size={15} />}
          placeholder="Domain or IP (e.g. example.com)"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookupAll()}
        />
        <Button variant="primary" icon={loading ? <Spinner size={14} /> : <Search size={15} />} onClick={lookupAll} disabled={loading}>
          Lookup
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Type tabs */}
        <Card className="col-span-12 lg:col-span-3 p-3">
          <div className="space-y-0.5">
            {TYPES.map((t) => {
              const count = results[t]?.records.length
              return (
                <button
                  key={t}
                  onClick={() => setActive(t)}
                  className={`no-drag w-full flex items-center justify-between px-3 h-10 rounded-lg text-sm transition-colors ${
                    active === t ? 'bg-white/[0.07] text-ink-50 border border-white/[0.08]' : 'text-ink-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="font-mono font-medium">{t}</span>
                  {count != null && (
                    <span className={`text-xs tabular-nums ${count ? 'text-ink-200' : 'text-ink-600'}`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Records */}
        <Card className="col-span-12 lg:col-span-9 p-6 min-h-[340px]">
          <CardHeader
            title={`${active} Records`}
            action={
              <div className="flex items-center gap-2">
                {current && !current.error && <Badge tone="outline">{current.durationMs}ms</Badge>}
                {current && current.records.length > 0 && (
                  <button onClick={copyCurrent} className="no-drag text-ink-500 hover:text-ink-200">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
              </div>
            }
          />
          <div className="mt-4 selectable">
            {loading && <EmptyState icon={<Spinner size={28} />} title="Resolving records…" />}
            {!loading && !current && (
              <EmptyState icon={<Globe size={28} />} title="No lookup yet" hint="Enter a domain and press Lookup to resolve all record types." />
            )}
            {!loading && current && current.error && (
              <div className="text-sm text-ink-400 px-1 py-3">{current.error}</div>
            )}
            {!loading && current && !current.error && current.records.length === 0 && (
              <div className="text-sm text-ink-500 px-1 py-3">No {active} records found.</div>
            )}
            <div className="space-y-1.5 font-mono text-sm">
              {current?.records.map((rec, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="px-3 py-2.5 rounded-lg bg-ink-850 border border-white/[0.05] text-ink-100 break-all"
                >
                  {rec}
                </motion.div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
