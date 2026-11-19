import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from 'recharts'

// ---------- Inline SVG sparkline (lightweight, for cards) ----------
export function Sparkline({
  data,
  width = 220,
  height = 56,
  strokeWidth = 1.5
}: {
  data: number[]
  width?: number
  height?: number
  strokeWidth?: number
}): JSX.Element {
  if (data.length < 2) {
    return <div style={{ height }} className="flex items-center text-xs text-ink-500">Collecting…</div>
  }
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const pts = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 6) - 3
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="#f2f2f2" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ---------- Latency area chart (Recharts) ----------
export interface LatencyPoint {
  seq: number
  latency: number | null
}

export function LatencyChart({ data, height = 240 }: { data: LatencyPoint[]; height?: number }): JSX.Element {
  const valid = data.filter((d) => d.latency != null) as { seq: number; latency: number }[]
  const avg = valid.length ? valid.reduce((a, b) => a + b.latency, 0) / valid.length : 0
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="lat-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="seq" tick={{ fill: '#4c4c4c', fontSize: 10, fontFamily: 'Cascadia Mono, Consolas, monospace' }} axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis tick={{ fill: '#4c4c4c', fontSize: 10, fontFamily: 'Cascadia Mono, Consolas, monospace' }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          contentStyle={{
            background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 2, fontFamily: "Cascadia Mono, Consolas, monospace", fontSize: 12, color: '#e8e8e8'
          }}
          labelStyle={{ color: '#7a7a7a' }}
          formatter={(v: number) => [`${v} ms`, 'latency']}
        />
        {avg > 0 && (
          <ReferenceLine y={avg} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4"
            label={{ value: `avg ${avg.toFixed(0)}ms`, fill: '#7a7a7a', fontSize: 10, position: 'right' }} />
        )}
        <Area
          type="monotone" dataKey="latency" stroke="#f2f2f2" strokeWidth={1.75}
          fill="url(#lat-fill)" isAnimationActive={false} connectNulls={false} dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ---------- Mini bar group (e.g. port/asset distribution) ----------
export function MiniBars({
  items,
  height = 120
}: {
  items: { label: string; value: number }[]
  height?: number
}): JSX.Element {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {items.map((it) => (
        <div key={it.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
          <span className="text-sm font-semibold text-ink-100 tabular-nums">{it.value}</span>
          <div className="w-full hatch bg-white/[0.08] border-t border-white transition-all duration-700 ease-premium"
            style={{ height: `${(it.value / max) * (height - 44)}px` }} />
          <span className="label text-[0.5rem] truncate w-full text-center">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
