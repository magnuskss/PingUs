import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { NAV, GROUP_LABELS } from '../lib/nav'
import type { ModuleId } from '@shared/types'
import { Hatch, ScrambleText } from './fx'

const pad = (n: number): string => String(n).padStart(2, '0')
const GROUPS = ['diagnostics', 'discovery', 'data'] as const
// Room for the native caption buttons drawn by titleBarOverlay.
const CAPTION_GUTTER = 'pr-[150px]'

export function TopBar({
  active,
  onSelect
}: {
  active: ModuleId
  onSelect: (id: ModuleId) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const index = NAV.findIndex((n) => n.id === active)
  const item = NAV[index]

  const go = (id: ModuleId): void => {
    onSelect(id)
    setOpen(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (!open) return
      if (e.key === 'Escape') setOpen(false)
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= 9 && NAV[n - 1]) go(NAV[n - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      <header className={`relative z-[60] h-14 shrink-0 drag flex items-center border-b border-[var(--hair)] bg-ink-900/90 backdrop-blur ${CAPTION_GUTTER}`}>
        <div className="flex items-center gap-3 pl-6 w-[25%] min-w-[200px]">
          <Logo />
        </div>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <Hatch className="h-3 w-6 shrink-0" dim />
          <span className="font-mono text-[0.6875rem] tracking-[0.16em] uppercase text-ink-300 truncate">
            <span className="text-ink-500">{pad(index + 1)}</span>
            <span className="text-ink-600 mx-2">—</span>
            <ScrambleText text={item?.label ?? ''} />
          </span>
        </div>

        <div className="flex items-center gap-4 pr-4">
          <Clock />
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="no-drag focusable group flex items-center gap-3 h-9 pl-3.5 pr-3 border border-[var(--hair)] hover:border-[var(--hair-strong)] bg-ink-900 transition-colors"
          >
            <span className="font-mono text-[0.6875rem] tracking-[0.16em] text-ink-200 group-hover:text-ink-50">
              {open ? 'CLOSE' : 'MENU'}
            </span>
            <BurgerIcon open={open} />
          </button>
        </div>
      </header>

      <AnimatePresence>{open && <MenuOverlay active={active} onSelect={go} />}</AnimatePresence>
    </>
  )
}

function BurgerIcon({ open }: { open: boolean }): JSX.Element {
  const t = { type: 'spring', stiffness: 520, damping: 32 } as const
  return (
    <span className="relative block w-[18px] h-[10px]">
      <motion.span
        className="absolute left-0 right-0 top-0 h-px bg-ink-50"
        animate={open ? { top: 5, rotate: 45 } : { top: 0, rotate: 0 }}
        transition={t}
      />
      <motion.span
        className="absolute right-0 bottom-0 h-px bg-ink-50"
        animate={open ? { bottom: 4, rotate: -45, width: 18 } : { bottom: 0, rotate: 0, width: 12 }}
        transition={t}
      />
    </span>
  )
}

function Clock(): JSX.Element {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="hidden lg:inline font-mono text-[0.6875rem] tracking-[0.12em] text-ink-400 tabular-nums">
      {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </span>
  )
}

function Logo(): JSX.Element {
  return (
    <div className="flex items-center gap-2.5 no-drag select-none">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-ink-50">
        <path d="M2 21 L2 13 L10 21 Z" fill="currentColor" />
        <path d="M5 11h3l2-5 4 12 2.5-7H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
      <span className="font-display text-[1.15rem] font-semibold tracking-[-0.03em] text-ink-50">pingus</span>
    </div>
  )
}

function MenuOverlay({ active, onSelect }: { active: ModuleId; onSelect: (id: ModuleId) => void }): JSX.Element {
  let order = 0
  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 top-14 z-50 app-bg overflow-y-auto"
      initial={{ clipPath: 'circle(0px at calc(100% - 210px) 0px)' }}
      animate={{ clipPath: 'circle(2400px at calc(100% - 210px) 0px)' }}
      exit={{ clipPath: 'circle(0px at calc(100% - 210px) 0px)' }}
      transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="scanlines absolute inset-0" />
      <div className="relative grid grid-cols-12 gap-x-8 px-6 pt-12 pb-10 min-h-full">
        <motion.aside
          className="col-span-12 xl:col-span-3 mb-10 xl:mb-0"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <Hatch className="h-3 w-8" />
            <span className="label text-ink-300">Navigation</span>
          </div>
          <p className="font-display text-[1.9rem] leading-[1.05] tracking-[-0.035em] text-ink-50 max-w-[16ch]">
            Every instrument on your network, one keystroke away.
          </p>
          <div className="mt-10 space-y-2.5 font-mono text-[0.6875rem] tracking-[0.12em] text-ink-400">
            <Hint k="1–9" v="jump to module" />
            <Hint k="CTRL K" v="toggle menu" />
            <Hint k="ESC" v="close" />
          </div>
        </motion.aside>

        <nav className="col-span-12 xl:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
          {GROUPS.map((g, gi) => (
            <div key={g}>
              <div className="flex items-center justify-between pb-3 border-b border-[var(--hair-strong)]">
                <span className="label text-ink-200">
                  {String.fromCharCode(65 + gi)} — {GROUP_LABELS[g]}
                </span>
                <span className="font-mono text-[0.625rem] text-ink-500">
                  {pad(NAV.filter((n) => n.group === g).length)}
                </span>
              </div>
              <ul>
                {NAV.filter((n) => n.group === g).map((item) => {
                  const i = NAV.indexOf(item)
                  const delay = 0.16 + order++ * 0.035
                  return (
                    <motion.li
                      key={item.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <MenuItem
                        index={i + 1}
                        label={item.label}
                        short={item.short}
                        current={item.id === active}
                        onClick={() => onSelect(item.id)}
                      />
                    </motion.li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </motion.div>
  )
}

function MenuItem({
  index,
  label,
  short,
  current,
  onClick
}: {
  index: number
  label: string
  short: string
  current: boolean
  onClick: () => void
}): JSX.Element {
  const [hover, setHover] = useState(0)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover((h) => h + 1)}
      className="focusable group relative w-full text-left flex items-start gap-4 py-4 border-b border-[var(--hair)] overflow-hidden"
    >
      <span className="absolute inset-0 hatch-dim opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <span className="relative font-mono text-[0.6875rem] text-ink-500 pt-2 w-6">{pad(index)}</span>
      <span className="relative flex-1 min-w-0 transition-transform duration-300 ease-premium group-hover:translate-x-1.5">
        <span className={`block font-display text-[1.55rem] leading-tight tracking-[-0.03em] ${current ? 'text-ink-50' : 'text-ink-200 group-hover:text-ink-50'}`}>
          {label}
        </span>
        <span className="block mt-1 font-mono text-[0.625rem] tracking-[0.16em] uppercase text-ink-500">
          <ScrambleText text={short} replayKey={hover} duration={320} />
        </span>
      </span>
      <span className="relative pt-2.5 flex items-center gap-2">
        {current && (
          <span className="flex items-center gap-1.5 font-mono text-[0.5625rem] tracking-[0.16em] text-ink-100">
            <span className="h-1.5 w-1.5 bg-ink-50" /> CURRENT
          </span>
        )}
        <ArrowUpRight size={16} className="text-ink-50 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
      </span>
    </button>
  )
}

function Hint({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex min-w-[52px] justify-center border border-[var(--hair-strong)] px-1.5 py-0.5 text-ink-200">{k}</span>
      <span className="uppercase">{v}</span>
    </div>
  )
}
