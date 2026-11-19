import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const GLYPHS = '!<>-_\\/[]{}—=+*^?#01ABCDEFX'

/**
 * Decodes text from random glyphs into the real string, left to right.
 * Re-runs whenever `text` (or `replayKey`) changes. Static under reduced motion.
 */
export function ScrambleText({
  text,
  className = '',
  duration = 520,
  replayKey
}: {
  text: string
  className?: string
  duration?: number
  replayKey?: unknown
}): JSX.Element {
  const reduce = useReducedMotion()
  const [out, setOut] = useState(text)
  const frame = useRef<number>()

  useEffect(() => {
    if (reduce) {
      setOut(text)
      return
    }
    const start = performance.now()
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / duration)
      const settled = Math.floor(t * text.length)
      let s = ''
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (i < settled || ch === ' ') s += ch
        else s += GLYPHS[(Math.random() * GLYPHS.length) | 0]
      }
      setOut(s)
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [text, duration, reduce, replayKey])

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  )
}

/** Diagonal-hatch block, optionally marching (for live / busy states). */
export function Hatch({ className = '', running = false, dim = false }: { className?: string; running?: boolean; dim?: boolean }): JSX.Element {
  return <span aria-hidden className={`block ${dim ? 'hatch-dim' : 'hatch'} ${running ? 'hatch-run' : ''} ${className}`} />
}

/** Horizontal scan line that sweeps down once — played on every view change. */
export function ScanSweep({ playKey }: { playKey: unknown }): JSX.Element | null {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <motion.div
      key={String(playKey)}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-px bg-white/70 shadow-[0_0_18px_2px_rgba(255,255,255,0.35)]"
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: '100vh', opacity: 0 }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
    />
  )
}

const BOOT_LINES = [
  'PINGUS // NETWORK SUITE',
  'mounting interfaces .......... ok',
  'loading oui registry ......... ok',
  'arming probes ................ ok',
  'scope: authorized networks only'
]

/** Short start-up sequence. Click or any key skips it; skipped under reduced motion. */
export function BootSequence(): JSX.Element {
  const reduce = useReducedMotion()
  const [done, setDone] = useState(!!reduce)
  const [lines, setLines] = useState(0)

  useEffect(() => {
    if (done) return
    const timers = BOOT_LINES.map((_, i) => window.setTimeout(() => setLines(i + 1), 110 + i * 150))
    const end = window.setTimeout(() => setDone(true), 110 + BOOT_LINES.length * 150 + 380)
    const skip = (): void => setDone(true)
    window.addEventListener('keydown', skip)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(end)
      window.removeEventListener('keydown', skip)
    }
  }, [done])

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[100] bg-ink-900 flex items-center justify-center cursor-default"
          onClick={() => setDone(true)}
          exit={{ clipPath: 'inset(0 0 100% 0)' }}
          initial={{ clipPath: 'inset(0 0 0% 0)' }}
          transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="w-[420px] font-mono text-[0.75rem] leading-6 text-ink-300">
            <Hatch className="h-2 w-24 mb-6" running />
            {BOOT_LINES.slice(0, lines).map((l, i) => (
              <div key={l} className={i === 0 ? 'text-ink-50 tracking-[0.16em]' : ''}>
                {i === 0 ? <ScrambleText text={l} duration={420} /> : l}
              </div>
            ))}
            <span className="inline-block w-2 h-3.5 bg-ink-100 blink align-middle" />
            <div className="mt-6 h-px w-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-white"
                initial={{ width: '0%' }}
                animate={{ width: `${(lines / BOOT_LINES.length) * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
