import { useEffect, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from 'framer-motion'

/** Non-linear scale: each mark gets an equal slice of the arc, so 5 Mbps and 900 Mbps both read. */
const MARKS = [0, 5, 10, 25, 50, 100, 250, 500, 1000]
const SWEEP = 270
const START = -135 // degrees, 0 = straight up
const CX = 160, CY = 150, R = 118

function toFrac(v: number): number {
  if (v <= 0) return 0
  if (v >= MARKS[MARKS.length - 1]) return 1
  const i = MARKS.findIndex((m) => m > v) - 1
  const seg = 1 / (MARKS.length - 1)
  return i * seg + ((v - MARKS[i]) / (MARKS[i + 1] - MARKS[i])) * seg
}

function polar(deg: number, r: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

function arcPath(r: number): string {
  const [x0, y0] = polar(START, r)
  const [x1, y1] = polar(START + SWEEP, r)
  return `M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x1} ${y1}`
}

export type DialMode = 'idle' | 'latency' | 'download' | 'upload' | 'done' | 'error'

/**
 * Speedometer for the speed test. The needle and lit arc spring toward the live
 * reading (so 200 ms updates glide instead of jumping); while ping is being
 * measured a scanner sweeps the dial instead.
 */
export function SpeedDial({ value, mode, caption }: { value: number | null; mode: DialMode; caption: string }): JSX.Element {
  const reduce = useReducedMotion()
  const spring = useSpring(0, reduce ? { duration: 0 } : { stiffness: 70, damping: 18, mass: 0.8 })
  const measuring = mode === 'download' || mode === 'upload'

  useEffect(() => {
    spring.set(toFrac(value ?? 0))
  }, [value, spring])

  const angle = useTransform(spring, (f) => START + f * SWEEP)
  const [display, setDisplay] = useState('0')
  // Read the number off the spring so digits roll with the needle.
  useMotionValueEvent(spring, 'change', (f) => {
    let v = 0
    const seg = 1 / (MARKS.length - 1)
    const i = Math.min(MARKS.length - 2, Math.floor(f / seg))
    v = MARKS[i] + ((f - i * seg) / seg) * (MARKS[i + 1] - MARKS[i])
    if (f >= 1 && value != null) v = value
    setDisplay(v >= 100 ? v.toFixed(0) : v.toFixed(1))
  })

  const shown = mode === 'idle' || mode === 'latency' || (mode === 'error' && value == null) ? '—' : display

  const ticks: JSX.Element[] = []
  const majors = MARKS.length - 1
  for (let i = 0; i <= majors * 5; i++) {
    const major = i % 5 === 0
    const deg = START + (i / (majors * 5)) * SWEEP
    const [x0, y0] = polar(deg, R - 14)
    const [x1, y1] = polar(deg, R - (major ? 26 : 19))
    ticks.push(
      <line key={i} x1={x0} y1={y0} x2={x1} y2={y1}
        stroke={major ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)'} strokeWidth={major ? 1.4 : 1} />
    )
    if (major) {
      const [lx, ly] = polar(deg, R - 40)
      ticks.push(
        <text key={'l' + i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
          className="fill-ink-400 font-mono" fontSize={9} letterSpacing="0.05em">
          {MARKS[i / 5] >= 1000 ? '1G' : MARKS[i / 5]}
        </text>
      )
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <svg viewBox="0 0 320 262" className="w-full overflow-visible">
        <defs>
          <filter id="dial-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* track + ticks */}
        <path d={arcPath(R)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} strokeLinecap="butt" />
        <path d={arcPath(R + 9)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="2 5" />
        {ticks}

        {/* lit arc */}
        <motion.path d={arcPath(R)} fill="none" stroke="#f4f4f4" strokeWidth={8} pathLength={1}
          filter="url(#dial-glow)" strokeOpacity={mode === 'idle' ? 0 : 1} style={{ pathLength: spring }} />

        {/* scanner while measuring ping */}
        {mode === 'latency' && !reduce && (
          <motion.g style={{ originX: `${CX}px`, originY: `${CY}px` }}
            animate={{ rotate: [START, START + SWEEP, START] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
            <line x1={CX} y1={CY - R + 4} x2={CX} y2={CY - R + 30} stroke="#fff" strokeWidth={2} filter="url(#dial-glow)" />
          </motion.g>
        )}

        {/* needle */}
        {mode !== 'latency' && (
          <motion.g style={{ rotate: angle, originX: `${CX}px`, originY: `${CY}px` }}>
            <line x1={CX} y1={CY + 12} x2={CX} y2={CY - R + 22} stroke="#fff" strokeWidth={1.6}
              opacity={mode === 'idle' ? 0.35 : 1} />
            <circle cx={CX} cy={CY - R + 22} r={2.6} fill="#fff" filter="url(#dial-glow)" opacity={mode === 'idle' ? 0 : 1} />
          </motion.g>
        )}
        <circle cx={CX} cy={CY} r={5} fill="#0a0a0a" stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} />
      </svg>

      {/* readout */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[3.25rem] leading-none font-semibold text-ink-50 tabular-nums">{shown}</span>
          <span className="text-ink-400 text-sm font-medium">Mbps</span>
        </div>
        <div className={`mt-2 font-mono text-[0.625rem] uppercase tracking-[0.2em] ${
          mode === 'error' ? 'text-bad' : measuring || mode === 'latency' ? 'text-ink-100' : 'text-ink-500'}`}>
          {(measuring || mode === 'latency') && !reduce && (
            <motion.span className="inline-block mr-2 h-1.5 w-1.5 bg-ink-50 align-middle"
              animate={{ opacity: [1, 0.15, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
          )}
          {caption}
        </div>
      </div>
    </div>
  )
}

/**
 * Live trace of the whole run: download fills the first part, upload the rest,
 * with a glowing head at the newest sample.
 */
export function SpeedTrace({
  down, up, downMs, upMs, height = 96
}: {
  down: { t: number; v: number }[]
  up: { t: number; v: number }[]
  downMs: number
  upMs: number
  height?: number
}): JSX.Element {
  const W = 600
  const total = downMs + upMs
  const max = Math.max(10, ...down.map((p) => p.v), ...up.map((p) => p.v)) * 1.12
  const x = (t: number, offset: number): number => ((offset + Math.min(t, offset ? upMs : downMs)) / total) * W
  const y = (v: number): number => height - (v / max) * (height - 6)
  const line = (pts: { t: number; v: number }[], off: number): string =>
    pts.map((p, i) => `${i ? 'L' : 'M'} ${x(p.t, off).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  const area = (pts: { t: number; v: number }[], off: number): string =>
    pts.length ? `${line(pts, off)} L ${x(pts[pts.length - 1].t, off).toFixed(1)} ${height} L ${x(pts[0].t, off).toFixed(1)} ${height} Z` : ''
  const split = (downMs / total) * W
  const head = up.length ? { ...up[up.length - 1], off: downMs } : down.length ? { ...down[down.length - 1], off: 0 } : null

  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="trace-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={height * f} y2={height * f} stroke="rgba(255,255,255,0.05)" vectorEffect="non-scaling-stroke" />
      ))}
      <line x1={split} x2={split} y1={0} y2={height} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      <path d={area(down, 0)} fill="url(#trace-fill)" />
      <path d={line(down, 0)} fill="none" stroke="#f4f4f4" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <path d={area(up, downMs)} fill="url(#trace-fill)" opacity={0.6} />
      <path d={line(up, downMs)} fill="none" stroke="#bdbdbd" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      {head && (
        <line x1={x(head.t, head.off)} x2={x(head.t, head.off)} y1={0} y2={height}
          stroke="rgba(255,255,255,0.45)" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  )
}
