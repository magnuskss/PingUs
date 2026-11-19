import { motion } from 'framer-motion'
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'

// ---------- Card ----------
export function Card({
  children,
  className = '',
  raised = false,
  interactive = false
}: {
  children: ReactNode
  className?: string
  raised?: boolean
  interactive?: boolean
}): JSX.Element {
  return (
    <div
      className={`card ${raised ? 'card-raised' : ''} ${
        interactive ? 'transition-colors duration-300 ease-premium hover:border-[var(--hair-strong)]' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  action,
  className = ''
}: {
  title: string
  action?: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <span className="label">{title}</span>
      {action}
    </div>
  )
}

// ---------- Label ----------
export function Label({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return <span className={`label ${className}`}>{children}</span>
}

// ---------- Stat ----------
export function Stat({
  value,
  label,
  unit,
  size = 'md',
  tone = 'default'
}: {
  value: ReactNode
  label?: string
  unit?: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'default' | 'muted' | 'accent'
}): JSX.Element {
  const sizes = {
    sm: 'text-xl',
    md: 'text-stat',
    lg: 'text-hero'
  }
  const tones = {
    default: 'text-ink-50',
    muted: 'text-ink-300',
    accent: 'text-accent'
  }
  return (
    <div className="flex flex-col gap-2">
      <div className={`font-semibold leading-none tracking-tight tabular-nums ${sizes[size]} ${tones[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-ink-400 text-[0.42em] font-medium align-baseline tracking-normal">{unit}</span>}
      </div>
      {label && <Label>{label}</Label>}
    </div>
  )
}

// ---------- StatusDot ----------
export function StatusDot({
  state,
  label,
  pulse = false
}: {
  state: 'good' | 'warn' | 'bad' | 'idle'
  label?: string
  pulse?: boolean
}): JSX.Element {
  const colors = {
    good: 'bg-good',
    warn: 'bg-warn',
    bad: 'bg-bad',
    idle: 'bg-ink-500'
  }
  const glow = {
    good: 'shadow-[0_0_10px_rgba(62,224,143,0.65)]',
    warn: 'shadow-[0_0_10px_rgba(255,180,61,0.6)]',
    bad: 'shadow-[0_0_10px_rgba(255,90,79,0.6)]',
    idle: ''
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${colors[state]} ${glow[state]} ${pulse ? 'pulse-dot' : ''}`} />
      {label && <span className="text-sm text-ink-200">{label}</span>}
    </span>
  )
}

// ---------- Button ----------
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'quiet'
  size?: 'sm' | 'md'
  icon?: ReactNode
}
export function Button({
  children,
  variant = 'ghost',
  size = 'md',
  icon,
  className = '',
  ...rest
}: BtnProps): JSX.Element {
  const base =
    'no-drag focusable inline-flex items-center justify-center gap-2 rounded-panel font-mono uppercase tracking-[0.14em] transition-colors duration-200 ease-premium active:translate-y-px disabled:opacity-40 disabled:pointer-events-none'
  const sizes = { sm: 'h-8 px-3 text-[0.625rem]', md: 'h-9 px-4 text-[0.6875rem]' }
  const variants = {
    primary: 'bg-ink-50 text-ink-950 hover:bg-white',
    ghost: 'bg-ink-900 text-ink-100 border border-[var(--hair-strong)] hover:border-white/40 hover:text-ink-50',
    danger: 'bg-ink-900 text-bad border border-bad/40 hover:bg-bad hover:text-ink-950',
    quiet: 'text-ink-300 hover:text-ink-50 hover:bg-white/[0.05]'
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  )
}

// ---------- Input ----------
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
}
export function Field({ icon, className = '', ...rest }: FieldProps): JSX.Element {
  return (
    <div
      className={`no-drag flex items-center gap-2 h-9 px-3 rounded-panel bg-ink-950 border border-[var(--hair-strong)] focus-within:border-white/60 transition-colors ${className}`}
    >
      {icon && <span className="text-ink-400">{icon}</span>}
      <input
        className="flex-1 min-w-0 bg-transparent outline-none font-mono text-[0.8125rem] text-ink-50 placeholder:text-ink-500 selectable"
        spellCheck={false}
        {...rest}
      />
    </div>
  )
}

// ---------- Select ----------
export function Select({
  value,
  onChange,
  options,
  className = ''
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`no-drag focusable h-9 px-3 rounded-panel bg-ink-950 border border-[var(--hair-strong)] font-mono text-[0.75rem] text-ink-100 outline-none hover:border-[var(--hair-strong)] transition-colors ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink-800">
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ---------- Toggle ----------
export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}): JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="no-drag focusable inline-flex items-center gap-2.5 group"
    >
      <span
        className={`relative h-[18px] w-8 rounded-full transition-colors duration-200 ${
          checked ? 'bg-accent' : 'bg-ink-650'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full ${checked ? 'left-[16px] bg-ink-950' : 'left-[2px] bg-ink-200'}`}
        />
      </span>
      {label && <span className="text-sm text-ink-200 group-hover:text-ink-100 transition-colors">{label}</span>}
    </button>
  )
}

// ---------- ProgressBar ----------
export function ProgressBar({
  pct,
  tone = 'accent',
  className = ''
}: {
  pct: number
  tone?: 'accent' | 'neutral'
  className?: string
}): JSX.Element {
  return (
    <div className={`h-1.5 w-full hatch-dim overflow-hidden ${className}`}>
      <motion.div
        className={`h-full ${tone === 'accent' ? 'bg-ink-50 shadow-[0_0_10px_rgba(255,255,255,0.45)]' : 'bg-ink-300'}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
      />
    </div>
  )
}

// ---------- Badge ----------
export function Badge({
  children,
  tone = 'default'
}: {
  children: ReactNode
  tone?: 'default' | 'solid' | 'outline' | 'accent'
}): JSX.Element {
  const tones = {
    default: 'bg-transparent text-ink-300 border border-[var(--hair-strong)]',
    solid: 'bg-ink-50 text-ink-950',
    outline: 'bg-transparent text-ink-400 border border-dashed border-[var(--hair-strong)]',
    accent: 'bg-white/[0.06] text-ink-50 border border-white/30'
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[0.5625rem] font-medium uppercase tracking-[0.14em] ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

// ---------- Tag (icon + text pill, for device types etc.) ----------
export function Tag({
  icon,
  children,
  tone = 'default'
}: {
  icon?: ReactNode
  children: ReactNode
  tone?: 'default' | 'accent' | 'good' | 'bad'
}): JSX.Element {
  const tones = {
    default: 'bg-ink-900 text-ink-200 border-[var(--hair-strong)]',
    accent: 'bg-white/[0.06] text-ink-50 border-white/30',
    good: 'bg-good/10 text-good border-good/30',
    bad: 'bg-bad/10 text-bad border-bad/30'
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] font-mono text-[0.6875rem] tracking-[0.04em] ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  )
}

// ---------- KeyValue row ----------
export function KeyValue({
  label,
  value,
  mono = false
}: {
  label: string
  value: ReactNode
  mono?: boolean
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-ink-400 shrink-0">{label}</span>
      <span className={`text-sm text-ink-100 text-right truncate selectable ${mono ? 'font-mono text-[0.8125rem]' : ''}`}>
        {value}
      </span>
    </div>
  )
}

// ---------- Spinner ----------
export function Spinner({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin text-ink-50">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ---------- EmptyState ----------
export function EmptyState({
  icon,
  title,
  hint
}: {
  icon?: ReactNode
  title: string
  hint?: string
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      {icon && <div className="text-ink-500">{icon}</div>}
      <div className="text-ink-200 text-sm font-medium">{title}</div>
      {hint && <div className="text-ink-400 text-xs max-w-sm leading-relaxed">{hint}</div>}
    </div>
  )
}

// ---------- Skeleton ----------
export function Skeleton({ className = '' }: { className?: string }): JSX.Element {
  return <div className={`skeleton rounded-md ${className}`} />
}
