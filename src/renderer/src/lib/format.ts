export function ms(v: number | null | undefined, digits = 0): string {
  if (v == null) return '—'
  return `${v.toFixed(digits)}`
}

export function pct(v: number | null | undefined, digits = 0): string {
  if (v == null) return '—'
  return `${v.toFixed(digits)}%`
}

export function mbps(v: number | null | undefined): string {
  if (v == null) return '—'
  return v >= 100 ? v.toFixed(0) : v.toFixed(1)
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function dateTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
