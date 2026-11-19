import { spawn } from 'node:child_process'
import { run, sanitizeHost } from './exec'
import type { PingResult } from '@shared/types'

// Windows `ping` output parsing. Examples:
//   Reply from 1.1.1.1: bytes=32 time=12ms TTL=59
//   Reply from 1.1.1.1: bytes=32 time<1ms TTL=128
//   Request timed out.
//   Reply from 10.0.0.1: Destination host unreachable.
const RE_TIME = /time[=<]\s*(\d+)\s*ms/i
const RE_TTL = /TTL=(\d+)/i

export function parsePingLine(line: string, seq: number, host: string): PingResult | null {
  const l = line.trim()
  if (!l) return null
  const base = { seq, timestamp: Date.now(), host }
  if (/Reply from/i.test(l) && RE_TIME.test(l)) {
    const t = l.match(RE_TIME)
    const ttl = l.match(RE_TTL)
    // Guard: "Destination host unreachable" also starts with Reply from
    if (/unreachable/i.test(l)) {
      return { ...base, success: false, latencyMs: null, ttl: null, error: 'Host unreachable' }
    }
    const lt = l.includes('time<') ? 0.5 : Number(t?.[1] ?? NaN)
    return {
      ...base,
      success: true,
      latencyMs: Number.isNaN(lt) ? null : lt,
      ttl: ttl ? Number(ttl[1]) : null
    }
  }
  if (/unreachable/i.test(l)) {
    return { ...base, success: false, latencyMs: null, ttl: null, error: 'Host unreachable' }
  }
  if (/timed out/i.test(l)) {
    return { ...base, success: false, latencyMs: null, ttl: null, error: 'Request timed out' }
  }
  if (/could not find host|transmit failed|general failure/i.test(l)) {
    return { ...base, success: false, latencyMs: null, ttl: null, error: l }
  }
  return null
}

/** Single ping (one echo). */
export async function pingOnce(host: string, timeoutMs = 2000): Promise<PingResult> {
  const h = sanitizeHost(host)
  if (!h) {
    return { seq: 0, timestamp: Date.now(), host, success: false, latencyMs: null, ttl: null, error: 'Invalid host' }
  }
  const r = await run('ping', ['-n', '1', '-w', String(timeoutMs), h], { timeoutMs: timeoutMs + 2000 })
  for (const line of r.stdout.split(/\r?\n/)) {
    const parsed = parsePingLine(line, 0, h)
    if (parsed) return parsed
  }
  return { seq: 0, timestamp: Date.now(), host: h, success: false, latencyMs: null, ttl: null, error: 'No reply' }
}

export interface PingSession {
  stop: () => void
}

/**
 * Continuous ping. Spawns `ping -t` and emits a PingResult per reply line.
 * Returns a handle to stop the session.
 */
export function pingContinuous(
  host: string,
  onResult: (r: PingResult) => void,
  timeoutMs = 2000
): PingSession {
  const h = sanitizeHost(host)
  if (!h) {
    queueMicrotask(() =>
      onResult({ seq: 0, timestamp: Date.now(), host, success: false, latencyMs: null, ttl: null, error: 'Invalid host' })
    )
    return { stop: () => {} }
  }
  const child = spawn('ping', ['-t', '-w', String(timeoutMs), h], { windowsHide: true })
  let seq = 0
  let buf = ''
  const handle = (chunk: Buffer): void => {
    buf += chunk.toString()
    const lines = buf.split(/\r?\n/)
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const parsed = parsePingLine(line, seq, h)
      if (parsed) {
        seq += 1
        onResult({ ...parsed, seq })
      }
    }
  }
  child.stdout?.on('data', handle)
  child.on('error', (err) => {
    onResult({ seq: ++seq, timestamp: Date.now(), host: h, success: false, latencyMs: null, ttl: null, error: err.message })
  })
  return { stop: () => child.kill() }
}
