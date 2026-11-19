import { motion, useReducedMotion } from 'framer-motion'
import { Monitor, Router, Globe2, type LucideIcon } from 'lucide-react'
import { ms } from '../lib/format'

interface Hop {
  icon: LucideIcon
  label: string
  value: string | null
}

/**
 * The path your traffic takes — this PC → gateway → internet — with packets
 * travelling each link. Packet speed follows the measured latency of that link,
 * a link with no reply turns red and goes quiet.
 */
export function RouteMap({
  host,
  localIp,
  gateway,
  publicIp,
  gatewayMs,
  internetMs,
  online,
  loading
}: {
  host: string | null
  localIp: string | null
  gateway: string | null
  publicIp: string | null
  gatewayMs: number | null
  internetMs: number | null
  online: boolean
  loading: boolean
}): JSX.Element {
  const hops: Hop[] = [
    { icon: Monitor, label: host ?? 'This PC', value: localIp },
    { icon: Router, label: 'Gateway', value: gateway },
    { icon: Globe2, label: 'Internet', value: publicIp ?? '1.1.1.1' }
  ]
  // Each link's own share of the round trip.
  const lan = gatewayMs
  const wan = internetMs != null ? Math.max(0, internetMs - (gatewayMs ?? 0)) : null
  const links: { label: string; latency: number | null; up: boolean }[] = [
    { label: 'LAN', latency: lan, up: !loading && lan != null },
    { label: 'WAN', latency: wan, up: !loading && online && wan != null }
  ]

  return (
    <div className="flex flex-col">
      {hops.map((hop, i) => (
        <div key={hop.label + i}>
          <HopNode hop={hop} index={i} active={!loading && (i === 0 || links[i - 1].up)} />
          {i < links.length && <Link {...links[i]} loading={loading} />}
        </div>
      ))}
    </div>
  )
}

function HopNode({ hop, index, active }: { hop: Hop; index: number; active: boolean }): JSX.Element {
  const Icon = hop.icon
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3"
    >
      <div
        className={`relative h-10 w-10 shrink-0 flex items-center justify-center border transition-colors duration-500 ${
          active ? 'border-white/40 bg-white/[0.06] text-ink-50 shadow-[0_0_14px_rgba(255,255,255,0.12)]' : 'border-[var(--hair-strong)] text-ink-500 hatch-dim'
        }`}
      >
        <Icon size={17} strokeWidth={1.6} />
        <span className="absolute -top-px -left-px h-1.5 w-1.5 border-t border-l border-white/70" />
        <span className="absolute -bottom-px -right-px h-1.5 w-1.5 border-b border-r border-white/70" />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-ink-400">
          {String(index + 1).padStart(2, '0')} · {hop.label}
        </div>
        <div className="font-mono text-[0.8125rem] text-ink-100 tabular-nums truncate selectable">{hop.value ?? '—'}</div>
      </div>
    </motion.div>
  )
}

function Link({ label, latency, up, loading }: { label: string; latency: number | null; up: boolean; loading: boolean }): JSX.Element {
  const reduce = useReducedMotion()
  // Faster link → faster packets. Clamped so it always reads as motion.
  const travel = latency == null ? 1.6 : Math.min(2.4, Math.max(0.55, 0.5 + latency / 40))
  const tone = loading ? 'text-ink-500' : up ? 'text-ink-200' : 'text-bad'

  return (
    <div className="flex items-stretch gap-3 h-16">
      <div className="relative w-10 shrink-0 flex justify-center">
        <div className={`w-px h-full ${up ? 'bg-white/25' : loading ? 'bg-white/10' : 'border-l border-dashed border-bad/60'}`} />
        {up && !reduce &&
          [0, 1, 2].map((k) => (
            <motion.span
              key={k}
              className="absolute left-1/2 -ml-[2px] h-[5px] w-[5px] bg-ink-50 shadow-[0_0_8px_rgba(255,255,255,0.9)]"
              initial={{ top: '-4%', opacity: 0 }}
              animate={{ top: ['-4%', '100%'], opacity: [0, 1, 1, 0] }}
              transition={{ duration: travel, repeat: Infinity, ease: 'linear', delay: (k * travel) / 3 }}
            />
          ))}
      </div>
      <div className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.16em]">
        <span className="text-ink-500">{label}</span>
        <span className={`tabular-nums ${tone}`}>
          {loading ? '···' : up ? `${ms(latency)} ms` : 'no reply'}
        </span>
      </div>
    </div>
  )
}
