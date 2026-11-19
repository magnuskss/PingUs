import { spawn } from 'node:child_process'
import { sanitizeHost } from './exec'
import type { TracerouteHop } from '@shared/types'

// Windows `tracert` line example:
//   1    <1 ms    <1 ms    <1 ms  10.0.0.1
//   2     8 ms     9 ms     7 ms  isp-gw [203.0.113.1]
//   5     *        *        *     Request timed out.
function parseTracertLine(line: string): TracerouteHop | null {
  const l = line.trim()
  const m = l.match(/^(\d+)\s+(.*)$/)
  if (!m) return null
  const hop = Number(m[1])
  const rest = m[2]
  const latencies: (number | null)[] = []
  // Grab up to 3 timing columns
  const timeTokens = rest.match(/(<?\d+\s*ms|\*)/g) ?? []
  for (const tok of timeTokens.slice(0, 3)) {
    if (tok === '*') latencies.push(null)
    else {
      const val = tok.includes('<') ? 0.5 : Number(tok.replace(/\s*ms/i, ''))
      latencies.push(Number.isNaN(val) ? null : val)
    }
  }
  // Host/IP is the trailing part after the timings
  let host: string | null = null
  let ip: string | null = null
  const ipMatch = rest.match(/\[([0-9a-fA-F:.]+)\]/)
  if (ipMatch) {
    ip = ipMatch[1]
    const nameMatch = rest.match(/([A-Za-z0-9._-]+)\s+\[/)
    host = nameMatch ? nameMatch[1] : null
  } else {
    const tail = rest.replace(/(<?\d+\s*ms|\*)/g, '').trim()
    if (tail && !/Request timed out/i.test(tail)) {
      if (/^[0-9a-fA-F:.]+$/.test(tail)) ip = tail
      else host = tail
    }
  }
  const valid = latencies.filter((x): x is number => x !== null)
  const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
  return { hop, host, ip, latenciesMs: latencies, avgMs: avg }
}

export interface TraceSession {
  stop: () => void
}

export function traceroute(
  host: string,
  onHop: (hop: TracerouteHop) => void,
  onDone: (err?: string) => void,
  maxHops = 30
): TraceSession {
  const h = sanitizeHost(host)
  if (!h) {
    queueMicrotask(() => onDone('Invalid host'))
    return { stop: () => {} }
  }
  const child = spawn('tracert', ['-d', '-h', String(maxHops), '-w', '2000', h], {
    windowsHide: true
  })
  let buf = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    buf += chunk.toString()
    const lines = buf.split(/\r?\n/)
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const hop = parseTracertLine(line)
      if (hop) onHop(hop)
    }
  })
  child.on('error', (err) => onDone(err.message))
  child.on('close', () => onDone())
  return { stop: () => child.kill() }
}
