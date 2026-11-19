import os from 'node:os'
import dns from 'node:dns'
import { run, isIpv4 } from './exec'
import { pingOnce } from './ping'
import { getGateway } from './overview'
import { lookupVendor, inferDeviceType } from './oui'
import { ssdpSearch, ssdpText, type SsdpInfo } from './ssdp'
import type { DiscoveredDevice, NetworkInterfaceInfo, PresenceUpdate } from '@shared/types'

const resolver = dns.promises

/** Derive the /24 base (e.g. 192.168.1) from the primary IPv4 interface. */
function getLocalSubnetBase(): { base: string; self: string } | null {
  const ifaces = os.networkInterfaces()
  for (const addrs of Object.values(ifaces)) {
    for (const a of addrs ?? []) {
      const fam = String(a.family) === 'IPv4' || String(a.family) === '4'
      if (fam && !a.internal && a.netmask === '255.255.255.0') {
        const parts = a.address.split('.')
        return { base: parts.slice(0, 3).join('.'), self: a.address }
      }
    }
  }
  return null
}

async function readArpTable(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const r = await run('arp', ['-a'], { timeoutMs: 6000 })
    for (const line of r.stdout.split(/\r?\n/)) {
      const m = line.trim().match(/^([0-9.]+)\s+([0-9a-fA-F-]{11,17})\s+(\w+)/)
      if (m && isIpv4(m[1])) {
        const mac = m[2].toLowerCase().replace(/-/g, ':')
        // Skip broadcast / multicast entries.
        if (mac !== 'ff:ff:ff:ff:ff:ff' && !mac.startsWith('01:00:5e')) map.set(m[1], mac)
      }
    }
  } catch {
    /* ignore */
  }
  return map
}

/**
 * Best-effort name for an IP: reverse DNS first, then the OS resolver
 * (getnameinfo — on Windows this also tries NetBIOS/LLMNR, which is how most
 * PCs on a home LAN are named).
 */
async function resolveName(ip: string): Promise<string | null> {
  try {
    const names = await resolver.reverse(ip)
    if (names[0]) return names[0]
  } catch {
    /* no PTR */
  }
  try {
    const { hostname } = await resolver.lookupService(ip, 0)
    if (hostname && hostname !== ip) return hostname
  } catch {
    /* unresolvable */
  }
  return null
}

export interface DiscoverySession {
  stop: () => void
}

interface Seen {
  reachable: boolean
  latencyMs: number | null
  ttl: number | null
  hostname: string | null
  source: 'arp' | 'ping'
}

/**
 * Discover devices on the local /24: a throttled ping sweep, the ARP cache, and
 * an SSDP/UPnP search (which finds TVs and speakers that ignore ping). Each
 * device is enriched with vendor, a guessed type with confidence + reason, and
 * gateway/self flags. A device may be emitted more than once as more evidence
 * arrives — consumers should merge by IP. Only sweeps the user's own subnet.
 */
export function discoverDevices(
  onDevice: (d: DiscoveredDevice) => void,
  onProgress: (done: number, total: number) => void,
  onDone: (err?: string) => void,
  customBase?: string | null
): DiscoverySession {
  let cancelled = false
  const local = getLocalSubnetBase()
  const base = customBase && /^\d+\.\d+\.\d+$/.test(customBase) ? customBase : local?.base
  if (!base) {
    queueMicrotask(() => onDone('No suitable local /24 interface found'))
    return { stop: () => {} }
  }

  ;(async () => {
    const ssdpPromise = ssdpSearch(base).catch(() => new Map<string, SsdpInfo>())
    const [arp0, gateway] = await Promise.all([readArpTable(), getGateway().catch(() => null)])
    let arp = arp0
    let ssdp = new Map<string, SsdpInfo>()
    const selfIp = local?.self ?? null
    const total = 254
    let done = 0
    let next = 1
    const now = Date.now()
    const seen = new Map<string, Seen>()

    const publish = (ip: string): void => {
      if (cancelled) return
      const s = seen.get(ip)
      if (!s) return
      const mac = arp.get(ip) ?? null
      const isGateway = gateway != null && ip === gateway
      const isSelf = selfIp != null && ip === selfIp
      const up = ssdp.get(ip)
      const guess = inferDeviceType({ mac, hostname: s.hostname, isGateway, ttl: s.ttl, upnp: ssdpText(up) })
      onDevice({
        ip,
        mac,
        hostname: s.hostname,
        vendor: isSelf ? 'This device' : lookupVendor(mac) ?? up?.manufacturer ?? null,
        deviceType: isSelf && guess.type === 'unknown' ? 'computer' : guess.type,
        confidence: guess.confidence,
        reason: isSelf ? 'This computer' : guess.reason,
        ttl: s.ttl,
        friendlyName: up?.friendlyName ?? null,
        model: up?.modelName ?? null,
        reachable: s.reachable,
        latencyMs: s.latencyMs,
        isGateway,
        isSelf,
        firstSeen: now,
        lastSeen: s.reachable ? now : 0,
        type: s.source
      })
    }

    async function worker(): Promise<void> {
      while (!cancelled) {
        const i = next++
        if (i > 254) return
        const ip = `${base}.${i}`
        const res = await pingOnce(ip, 700)
        done += 1
        onProgress(done, total)
        if (res.success && !cancelled) {
          seen.set(ip, { reachable: true, latencyMs: res.latencyMs, ttl: res.ttl, hostname: null, source: 'ping' })
          publish(ip)
          const hostname = await resolveName(ip)
          if (hostname) {
            seen.get(ip)!.hostname = hostname
            publish(ip)
          }
        }
      }
    }

    await Promise.all(Array.from({ length: 24 }, () => worker()))
    if (cancelled) return

    // The sweep fills the ARP cache, so re-read it: devices now get their MACs,
    // and hosts that block ping but answered ARP show up too.
    ;[arp, ssdp] = await Promise.all([readArpTable(), ssdpPromise])
    if (cancelled) return

    for (const ip of new Set([...arp.keys(), ...ssdp.keys()])) {
      if (!ip.startsWith(base + '.')) continue
      if (!seen.has(ip)) {
        // Answering SSDP means it's up right now; an ARP entry alone may be stale.
        seen.set(ip, { reachable: ssdp.has(ip), latencyMs: null, ttl: null, hostname: null, source: 'arp' })
      }
      publish(ip)
    }
    onDone()
  })().catch((e) => onDone((e as Error).message))

  return { stop: () => (cancelled = true) }
}

/**
 * Keep watching a set of known devices and report when each one goes online or
 * offline. Re-pings the whole set every `intervalMs`, throttled, until stopped.
 */
export function watchPresence(
  ips: string[],
  onUpdate: (u: PresenceUpdate) => void,
  intervalMs = 5000
): DiscoverySession {
  let cancelled = false
  const targets = ips.filter((ip) => isIpv4(ip))

  const tick = async (): Promise<void> => {
    const concurrency = 16
    let idx = 0
    const run = async (): Promise<void> => {
      while (!cancelled) {
        const i = idx++
        if (i >= targets.length) return
        const ip = targets[i]
        const res = await pingOnce(ip, 700)
        if (cancelled) return
        onUpdate({
          ip,
          reachable: res.success,
          latencyMs: res.latencyMs,
          lastSeen: res.success ? Date.now() : 0
        })
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length || 1) }, () => run()))
  }

  ;(async () => {
    while (!cancelled) {
      await tick()
      if (cancelled) break
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  })()

  return { stop: () => (cancelled = true) }
}

export function getInterfaceForDiscovery(): NetworkInterfaceInfo | null {
  const local = getLocalSubnetBase()
  if (!local) return null
  const ifaces = os.networkInterfaces()
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs ?? []) {
      if (a.address === local.self) {
        return {
          name,
          address: a.address,
          netmask: a.netmask,
          mac: a.mac,
          family: 'IPv4',
          internal: a.internal,
          cidr: a.cidr ?? null
        }
      }
    }
  }
  return null
}
