import net from 'node:net'
import { sanitizeHost, run } from './exec'
import type { PortResult } from '@shared/types'

// Common service names for well-known ports (subset).
const SERVICES: Record<number, string> = {
  20: 'ftp-data', 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns',
  67: 'dhcp', 68: 'dhcp', 69: 'tftp', 80: 'http', 110: 'pop3', 111: 'rpcbind',
  123: 'ntp', 135: 'msrpc', 137: 'netbios-ns', 138: 'netbios-dgm', 139: 'netbios-ssn',
  143: 'imap', 161: 'snmp', 389: 'ldap', 443: 'https', 445: 'microsoft-ds',
  465: 'smtps', 500: 'isakmp', 587: 'submission', 631: 'ipp', 636: 'ldaps',
  993: 'imaps', 995: 'pop3s', 1433: 'mssql', 1521: 'oracle', 1723: 'pptp',
  3306: 'mysql', 3389: 'rdp', 5060: 'sip', 5432: 'postgres', 5900: 'vnc',
  6379: 'redis', 8080: 'http-proxy', 8443: 'https-alt', 9000: 'cslistener',
  9200: 'elasticsearch', 27017: 'mongodb'
}

export const COMMON_PORTS = Object.keys(SERVICES).map(Number).sort((a, b) => a - b)

function checkPort(host: string, port: number, timeoutMs: number): Promise<PortResult> {
  return new Promise((resolve) => {
    const started = Date.now()
    const socket = new net.Socket()
    let settled = false
    const finish = (state: 'open' | 'closed'): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve({
        port,
        state,
        service: SERVICES[port] ?? null,
        latencyMs: state === 'open' ? Date.now() - started : null
      })
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish('open'))
    socket.once('timeout', () => finish('closed'))
    socket.once('error', () => finish('closed'))
    socket.connect(port, host)
  })
}

export interface ScanSession {
  stop: () => void
}

/** TCP connect scan across a port list, throttled. Emits each result. */
export function scanPorts(
  host: string,
  ports: number[],
  onResult: (r: PortResult) => void,
  onProgress: (done: number, total: number) => void,
  onDone: (err?: string) => void,
  timeoutMs = 1200
): ScanSession {
  const sanitized = sanitizeHost(host)
  if (!sanitized) {
    queueMicrotask(() => onDone('Invalid host'))
    return { stop: () => {} }
  }
  const h: string = sanitized
  const list = ports.filter((p) => p >= 1 && p <= 65535)
  let cancelled = false
  let idx = 0
  let done = 0
  const total = list.length
  const concurrency = 64

  async function worker(): Promise<void> {
    while (!cancelled) {
      const i = idx++
      if (i >= total) return
      const r = await checkPort(h, list[i], timeoutMs)
      done += 1
      onProgress(done, total)
      if (r.state === 'open') onResult(r)
    }
  }

  Promise.all(Array.from({ length: Math.min(concurrency, total || 1) }, () => worker()))
    .then(() => !cancelled && onDone())
    .catch((e) => onDone((e as Error).message))

  return { stop: () => (cancelled = true) }
}

/** A small set of ports whose presence helps classify a device. */
export const PROFILE_PORTS = [
  22, 80, 139, 443, 445, 515, 548, 554, 631, 1400, 1883, 3389, 5000, 5900,
  7000, 8009, 8096, 8554, 9100, 32400, 37777
]

/** Scan a host once and resolve with the list of open port numbers. */
export function profilePorts(host: string, ports: number[] = PROFILE_PORTS): Promise<number[]> {
  return new Promise((resolve) => {
    const open: number[] = []
    scanPorts(
      host,
      ports,
      (r) => open.push(r.port),
      () => {},
      () => resolve(open.sort((a, b) => a - b)),
      900
    )
  })
}

/** Optional: richer scan via nmap when available. Returns raw-ish parsed ports. */
export async function nmapScan(
  host: string,
  portSpec: string,
  nmapPath = 'nmap'
): Promise<{ results: PortResult[]; raw: string; error?: string }> {
  const h = sanitizeHost(host)
  if (!h) return { results: [], raw: '', error: 'Invalid host' }
  if (!/^[0-9,\-]+$/.test(portSpec)) return { results: [], raw: '', error: 'Invalid port spec' }
  try {
    const r = await run(nmapPath, ['-Pn', '-sV', '-p', portSpec, h], { timeoutMs: 120000 })
    const results: PortResult[] = []
    for (const line of r.stdout.split(/\r?\n/)) {
      const m = line.trim().match(/^(\d+)\/tcp\s+(open|closed|filtered)\s+(\S+)(?:\s+(.*))?/)
      if (m) {
        results.push({
          port: Number(m[1]),
          state: m[2] === 'open' ? 'open' : 'closed',
          service: m[4] ? `${m[3]} ${m[4]}`.trim() : m[3],
          latencyMs: null
        })
      }
    }
    return { results, raw: r.stdout }
  } catch (e) {
    return { results: [], raw: '', error: (e as Error).message }
  }
}
