import dns from 'node:dns'
import { sanitizeHost } from './exec'
import type { DnsLookupResult, DnsRecordType } from '@shared/types'

const resolver = dns.promises

export async function dnsLookup(
  host: string,
  type: DnsRecordType
): Promise<DnsLookupResult> {
  const name = sanitizeHost(host)
  const started = Date.now()
  if (!name) {
    return { type, name: host, records: [], error: 'Invalid hostname', durationMs: 0 }
  }
  try {
    let records: string[] = []
    switch (type) {
      case 'A':
        records = (await resolver.resolve4(name, { ttl: true })).map(
          (r) => `${r.address}  (ttl ${r.ttl}s)`
        )
        break
      case 'AAAA':
        records = (await resolver.resolve6(name, { ttl: true })).map(
          (r) => `${r.address}  (ttl ${r.ttl}s)`
        )
        break
      case 'MX':
        records = (await resolver.resolveMx(name)).map(
          (r) => `${r.priority}  ${r.exchange}`
        )
        break
      case 'TXT':
        records = (await resolver.resolveTxt(name)).map((r) => r.join(''))
        break
      case 'NS':
        records = await resolver.resolveNs(name)
        break
      case 'CNAME':
        records = await resolver.resolveCname(name)
        break
      case 'SOA': {
        const soa = await resolver.resolveSoa(name)
        records = [
          `primary: ${soa.nsname}`,
          `admin: ${soa.hostmaster}`,
          `serial: ${soa.serial}`,
          `refresh: ${soa.refresh}s  retry: ${soa.retry}s  expire: ${soa.expire}s  minttl: ${soa.minttl}s`
        ]
        break
      }
      case 'PTR':
        records = await resolver.reverse(name)
        break
    }
    return { type, name, records, durationMs: Date.now() - started }
  } catch (err) {
    return {
      type,
      name,
      records: [],
      error: (err as Error).message,
      durationMs: Date.now() - started
    }
  }
}

export async function reverseDns(ip: string): Promise<string[]> {
  const name = sanitizeHost(ip)
  if (!name) return []
  try {
    return await resolver.reverse(name)
  } catch {
    return []
  }
}
