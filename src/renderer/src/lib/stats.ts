import type { PingResult, PingStats } from '@shared/types'

export function computePingStats(results: PingResult[]): PingStats {
  const sent = results.length
  const ok = results.filter((r) => r.success && r.latencyMs != null)
  const received = ok.length
  const lost = sent - received
  const lats = ok.map((r) => r.latencyMs as number)
  const min = lats.length ? Math.min(...lats) : null
  const max = lats.length ? Math.max(...lats) : null
  const avg = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : null
  // Jitter: mean absolute difference between consecutive latencies
  let jitter: number | null = null
  if (lats.length > 1) {
    let sum = 0
    for (let i = 1; i < lats.length; i++) sum += Math.abs(lats[i] - lats[i - 1])
    jitter = sum / (lats.length - 1)
  }
  return {
    sent,
    received,
    lost,
    lossPct: sent ? (lost / sent) * 100 : 0,
    minMs: min,
    maxMs: max,
    avgMs: avg != null ? Math.round(avg * 10) / 10 : null,
    jitterMs: jitter != null ? Math.round(jitter * 10) / 10 : null
  }
}

/** Quality score 0-100 from latency + loss + jitter, for the health ring. */
export function healthScore(avgMs: number | null, lossPct: number, jitterMs: number | null): number {
  if (avgMs == null) return 0
  const latScore = Math.max(0, 100 - avgMs * 0.8) // 0ms->100, 125ms->0
  const lossScore = Math.max(0, 100 - lossPct * 5)
  const jitScore = jitterMs == null ? 100 : Math.max(0, 100 - jitterMs * 2)
  return Math.round(latScore * 0.45 + lossScore * 0.4 + jitScore * 0.15)
}
