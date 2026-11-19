import os from 'node:os'
import https from 'node:https'
import dns from 'node:dns'
import { run } from './exec'
import { pingOnce } from './ping'
import type { NetworkInterfaceInfo, OverviewSnapshot } from '@shared/types'

function listInterfaces(): NetworkInterfaceInfo[] {
  const out: NetworkInterfaceInfo[] = []
  const ifaces = os.networkInterfaces()
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs ?? []) {
      out.push({
        name,
        address: a.address,
        netmask: a.netmask,
        mac: a.mac,
        family: (String(a.family) === 'IPv4' || String(a.family) === '4' ? 'IPv4' : 'IPv6') as 'IPv4' | 'IPv6',
        internal: a.internal,
        cidr: a.cidr ?? null
      })
    }
  }
  return out
}

function pickPrimary(ifaces: NetworkInterfaceInfo[]): NetworkInterfaceInfo | null {
  return (
    ifaces.find((i) => i.family === 'IPv4' && !i.internal && i.address) ?? null
  )
}

export async function getGateway(): Promise<string | null> {
  try {
    // `route print -4 0.0.0.0` lists default route; gateway is 3rd column.
    const r = await run('cmd', ['/c', 'route print -4'], { timeoutMs: 6000 })
    const lines = r.stdout.split(/\r?\n/)
    for (const line of lines) {
      const m = line
        .trim()
        .match(/^0\.0\.0\.0\s+0\.0\.0\.0\s+([0-9.]+)\s+/)
      if (m && m[1] !== '0.0.0.0') return m[1]
    }
  } catch {
    /* ignore */
  }
  return null
}

function getPublicIp(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(
      'https://api.ipify.org',
      { timeout: 5000 },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          const ip = data.trim()
          resolve(/^[0-9a-fA-F:.]+$/.test(ip) ? ip : null)
        })
      }
    )
    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
  })
}

export async function getOverview(): Promise<OverviewSnapshot> {
  const interfaces = listInterfaces()
  const primary = pickPrimary(interfaces)
  const gateway = await getGateway()
  const dnsServers = dns.getServers().filter((s) => s && s !== '::1' && s !== '127.0.0.1')

  const [publicIp, gatewayPing, internetPing] = await Promise.all([
    getPublicIp(),
    gateway ? pingOnce(gateway, 1500) : Promise.resolve(null),
    pingOnce('1.1.1.1', 1500)
  ])

  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    online: internetPing?.success ?? publicIp !== null,
    publicIp,
    gateway,
    dnsServers,
    primaryInterface: primary,
    interfaces,
    gatewayLatencyMs: gatewayPing?.latencyMs ?? null,
    internetLatencyMs: internetPing?.latencyMs ?? null
  }
}
