import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, Fingerprint, Landmark, Globe, ShieldCheck, FileCode2, MapPin, Network, Copy, Check, ChevronRight,
  AlertTriangle, type LucideIcon
} from 'lucide-react'
import type { OsintResult, OsintSection } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, Button, Field, Badge, Spinner } from '../components/ui'
import { Hatch, ScrambleText } from '../components/fx'
import { saveHistory, copyToClipboard } from '../lib/export'

const META: Record<OsintSection, { title: string; icon: LucideIcon; querying: string; span: string }> = {
  registration: { title: 'Registration', icon: Landmark, querying: 'rdap.org', span: 'lg:col-span-6' },
  dns: { title: 'DNS & Email', icon: Globe, querying: 'resolver', span: 'lg:col-span-6' },
  tls: { title: 'Certificate', icon: ShieldCheck, querying: 'tls handshake :443', span: 'lg:col-span-6' },
  web: { title: 'Web Server', icon: FileCode2, querying: 'https response', span: 'lg:col-span-6' },
  ip: { title: 'IP Intelligence', icon: MapPin, querying: 'ipinfo.io · internetdb.shodan.io', span: 'lg:col-span-12' },
  subdomains: { title: 'Subdomains', icon: Network, querying: 'crt.sh · certspotter', span: 'lg:col-span-12' }
}

const DOMAIN_SECTIONS: OsintSection[] = ['registration', 'dns', 'tls', 'web', 'ip', 'subdomains']
const IP_SECTIONS: OsintSection[] = ['ip', 'registration', 'tls', 'web']

type Slot = { state: 'loading' | 'waiting' } | { state: 'done'; result: OsintResult }

export function OsintSearch(): JSX.Element {
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<{ target: string; kind: 'domain' | 'ip' } | null>(null)
  const [slots, setSlots] = useState<Partial<Record<OsintSection, Slot>>>({})
  const [ipFor, setIpFor] = useState<string | null>(null)
  const [trail, setTrail] = useState<string[]>([])
  const [invalid, setInvalid] = useState(false)
  const [copied, setCopied] = useState(false)
  const runId = useRef(0)

  const search = async (raw: string): Promise<void> => {
    const norm = await window.pingus.osintNormalize(raw)
    if (!norm) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    const id = ++runId.current
    setQuery(norm.target)
    setTarget(norm)
    setIpFor(norm.kind === 'ip' ? norm.target : null)
    setTrail((t) => [...t.filter((x) => x !== norm.target), norm.target].slice(-6))
    const sections = norm.kind === 'domain' ? DOMAIN_SECTIONS : IP_SECTIONS
    setSlots(Object.fromEntries(sections.map((s) => [s, { state: s === 'ip' && norm.kind === 'domain' ? 'waiting' : 'loading' }])))

    const results: OsintResult[] = []
    const land = (r: OsintResult): void => {
      results.push(r)
      if (runId.current === id) setSlots((s) => ({ ...s, [r.section]: { state: 'done', result: r } }))
    }
    const jobs = sections
      .filter((s) => !(s === 'ip' && norm.kind === 'domain'))
      .map((s) => window.pingus.osintLookup(s, norm.target).then(async (r) => {
        land(r)
        // A domain's IP intelligence follows from what it resolves to.
        if (s === 'dns' && norm.kind === 'domain') {
          const ip = r.ips?.find((x) => !x.includes(':')) ?? r.ips?.[0]
          if (!ip) {
            land({ section: 'ip', target: norm.target, ok: false, source: '', items: [], error: 'The domain has no address to look up' })
            return
          }
          if (runId.current === id) {
            setIpFor(ip)
            setSlots((sl) => ({ ...sl, ip: { state: 'loading' } }))
          }
          land({ ...(await window.pingus.osintLookup('ip', ip)), section: 'ip' })
        }
      }))
    await Promise.all(jobs)
    if (runId.current !== id) return
    const findings = results.flatMap((r) => r.items.filter((i) => i.tone === 'bad' || i.tone === 'warn'))
    await saveHistory('osint', `OSINT ${norm.target}`, norm.target,
      `${norm.kind} · ${results.filter((r) => r.ok).length}/${results.length} sources · ${findings.length} findings`, results)
  }

  const done = Object.values(slots).filter((s) => s?.state === 'done') as { state: 'done'; result: OsintResult }[]
  const busy = Object.values(slots).some((s) => s && s.state !== 'done')
  const findings = done.flatMap(({ result }) =>
    result.items.filter((i) => i.tone === 'bad' || i.tone === 'warn').map((i) => ({ ...i, section: result.section })))

  const copyReport = async (): Promise<void> => {
    const lines = [`OSINT report — ${target?.target}`, '']
    for (const { result } of done) {
      lines.push(`[${META[result.section].title}] ${result.source}`)
      if (result.error) lines.push(`  ! ${result.error}`)
      for (const i of result.items) lines.push(`  ${i.label}: ${i.value}`)
      if (result.list?.length) lines.push(...result.list.map((l) => `  - ${l}`))
      lines.push('')
    }
    await copyToClipboard(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div>
      <PageHeader
        title="OSINT Search"
        subtitle="Everything public about a domain or IP — registration, DNS, certificates, subdomains, hosting and known exposure."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Field
          className="max-w-xl flex-1 min-w-[260px]"
          icon={<Fingerprint size={15} />}
          placeholder="Domain or IP — e.g. example.com, 8.8.8.8"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setInvalid(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && search(query)}
        />
        <Button variant="primary" icon={busy ? <Spinner size={14} /> : <Search size={15} />} onClick={() => search(query)} disabled={busy || !query.trim()}>
          Investigate
        </Button>
        {done.length > 0 && !busy && (
          <Button icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copyReport}>Copy report</Button>
        )}
      </div>
      {invalid && <div className="mt-2 text-xs text-bad">That isn’t a domain or IP address.</div>}

      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-ink-500">
        {trail.length > 1 ? (
          <>
            <span>Trail</span>
            {trail.map((t, i) => (
              <span key={t} className="flex items-center gap-2">
                {i > 0 && <ChevronRight size={11} className="text-ink-600" />}
                <button onClick={() => search(t)} className={`no-drag normal-case tracking-normal hover:text-ink-50 ${t === target?.target ? 'text-ink-100' : ''}`}>{t}</button>
              </span>
            ))}
          </>
        ) : (
          <>
            <span>Try</span>
            {['github.com', 'cloudflare.com', '8.8.8.8'].map((t) => (
              <button key={t} onClick={() => search(t)} className="no-drag normal-case tracking-normal text-ink-300 hover:text-ink-50 border border-[var(--hair-strong)] px-2 py-0.5">
                {t}
              </button>
            ))}
          </>
        )}
      </div>

      {!target ? (
        <Card className="mt-6 p-10 flex flex-col items-center text-center">
          <Fingerprint size={30} className="text-ink-500" strokeWidth={1.4} />
          <div className="mt-4 text-ink-100">Start with a domain or an IP address</div>
          <p className="mt-2 max-w-lg text-sm text-ink-400 leading-relaxed">
            Uses only public records — registries, DNS, certificate logs and passive scan databases. The target sees no more
            than a normal visit to its website. Click any subdomain or address in the results to follow it.
          </p>
        </Card>
      ) : (
        <>
          {/* summary strip */}
          <Card className="mt-6 px-6 py-4" raised>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-3 min-w-0">
                <Badge tone="accent">{target.kind}</Badge>
                <ScrambleText text={target.target} replayKey={runId.current} className="font-mono text-lg text-ink-50 truncate" />
              </div>
              <div className="flex-1 min-w-[120px]">
                {busy ? <Hatch running className="h-2 w-full" /> : <div className="h-px w-full bg-[var(--hair-strong)]" />}
              </div>
              <div className="flex items-center gap-5 font-mono text-[0.625rem] uppercase tracking-[0.14em]">
                <span className="text-ink-400">{done.length}/{Object.keys(slots).length} sources</span>
                <span className={findings.some((f) => f.tone === 'bad') ? 'text-bad' : findings.length ? 'text-warn' : 'text-good'}>
                  {findings.length} findings
                </span>
              </div>
            </div>
            <AnimatePresence>
              {!busy && findings.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                  <div className="mt-4 pt-4 border-t border-[var(--hair)] flex flex-wrap gap-2">
                    {findings.map((f, i) => (
                      <span key={i} className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs ${f.tone === 'bad' ? 'border-bad/40 text-bad' : 'border-warn/40 text-warn'}`}>
                        <AlertTriangle size={11} /> {f.label}
                        <span className="text-ink-400">· {META[f.section].title}</span>
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          <div className="mt-4 grid grid-cols-12 gap-4">
            {(Object.keys(slots) as OsintSection[]).map((s, i) => (
              <SectionCard key={`${target.target}-${s}`} section={s} slot={slots[s]!} index={i}
                subtitle={s === 'ip' && ipFor && ipFor !== target.target ? ipFor : undefined}
                onPivot={(t) => search(t)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SectionCard({
  section, slot, index, subtitle, onPivot
}: {
  section: OsintSection
  slot: Slot
  index: number
  subtitle?: string
  onPivot: (target: string) => void
}): JSX.Element {
  const meta = META[section]
  const Icon = meta.icon
  const result = slot.state === 'done' ? slot.result : null

  return (
    <motion.div
      className={`col-span-12 ${meta.span}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="p-5 h-full">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon size={15} className="text-ink-400 shrink-0" />
            <span className="label">{meta.title}</span>
            {subtitle && (
              <button onClick={() => onPivot(subtitle)} className="no-drag font-mono text-[0.6875rem] text-ink-300 hover:text-ink-50 truncate">
                {subtitle} ↗
              </button>
            )}
          </div>
          {!result ? (
            <span className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-ink-500">
              {slot.state === 'waiting' ? 'waiting for dns' : 'querying'}
            </span>
          ) : result.ok ? (
            <span className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-good">ok</span>
          ) : (
            <span className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-bad">failed</span>
          )}
        </div>

        <div className="mt-4">
          {!result ? (
            <div className="space-y-2.5">
              <ScrambleText text={`> ${meta.querying}`} duration={900} replayKey={slot.state} className="font-mono text-xs text-ink-400" />
              {['w-[90%]', 'w-[70%]', 'w-[80%]'].map((w) => (
                <Hatch key={w} running={slot.state === 'loading'} dim className={`h-3 ${w}`} />
              ))}
            </div>
          ) : (
            <>
              {result.error && <div className="text-sm text-ink-300 mb-2">{result.error}</div>}
              {result.items.length > 0 && (
                <div className="divide-y divide-[var(--hair)]">
                  {result.items.map((it, i) => (
                    <motion.div key={it.label + i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      className="grid grid-cols-[9.5rem_1fr] gap-4 py-2 text-sm">
                      <span className="text-ink-400 flex items-center gap-2">
                        {it.tone && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${it.tone === 'good' ? 'bg-good' : it.tone === 'warn' ? 'bg-warn' : 'bg-bad'}`} />}
                        {it.label}
                      </span>
                      <ItemValue section={section} label={it.label} value={it.value} onPivot={onPivot} />
                    </motion.div>
                  ))}
                </div>
              )}
              {section === 'subdomains' && result.list && <SubdomainList names={result.list} onPivot={onPivot} />}
              {section === 'ip' && result.list && result.list.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.list.map((v) => (
                    <span key={v} className="font-mono text-[0.6875rem] text-bad border border-bad/40 px-1.5 py-0.5 selectable">{v}</span>
                  ))}
                </div>
              )}
              <div className="mt-4 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-ink-600">{result.source}</div>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

/** IP lists in DNS results are clickable — follow an address straight into its own lookup. */
function ItemValue({ section, label, value, onPivot }: { section: OsintSection; label: string; value: string; onPivot: (t: string) => void }): JSX.Element {
  if (section === 'dns' && (label === 'IPv4' || label === 'IPv6')) {
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1 min-w-0">
        {value.split(', ').map((ip) => (
          <button key={ip} onClick={() => onPivot(ip)} className="no-drag font-mono text-[0.8125rem] text-ink-100 hover:text-ink-50 underline decoration-dotted decoration-ink-500 underline-offset-4">
            {ip}
          </button>
        ))}
      </span>
    )
  }
  return <span className="text-ink-100 break-words min-w-0 selectable">{value}</span>
}

function SubdomainList({ names, onPivot }: { names: string[]; onPivot: (t: string) => void }): JSX.Element {
  const [filter, setFilter] = useState('')
  const [all, setAll] = useState(false)
  const shown = names.filter((n) => n.includes(filter.toLowerCase()))
  const visible = all ? shown : shown.slice(0, 60)
  return (
    <div className="mt-3">
      {names.length > 12 && (
        <Field className="max-w-xs mb-3" icon={<Search size={13} />} placeholder="Filter subdomains" value={filter} onChange={(e) => setFilter(e.target.value)} />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4">
        {visible.map((n) => (
          <button key={n} onClick={() => onPivot(n)}
            className="no-drag group flex items-center justify-between gap-2 py-1.5 border-b border-[var(--hair)] text-left font-mono text-[0.75rem] text-ink-200 hover:text-ink-50 min-w-0">
            <span className="truncate">{n}</span>
            <ChevronRight size={12} className="shrink-0 text-ink-600 group-hover:text-ink-100" />
          </button>
        ))}
      </div>
      {shown.length > visible.length && (
        <button onClick={() => setAll(true)} className="no-drag mt-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-ink-400 hover:text-ink-50">
          Show all {shown.length}
        </button>
      )}
    </div>
  )
}
