import { promises as dns } from 'node:dns'
import net from 'node:net'
import tls from 'node:tls'
import https from 'node:https'
import type { OsintItem, OsintResult, OsintSection } from '@shared/types'

/**
 * Passive OSINT on a domain or IP: public registries (RDAP), DNS, certificate
 * transparency logs, the site's own certificate and response headers, and IP
 * intelligence (ipinfo.io, Shodan InternetDB). Nothing here probes beyond what
 * a normal visit does — no scanning of the target.
 */

const UA = 'PingUs/0.1 (network diagnostics)'

/** Accepts "https://Example.com/path", "example.com", "1.2.3.4"; returns null if it's neither. */
export function normalizeTarget(raw: string): { target: string; kind: 'domain' | 'ip' } | null {
  let t = String(raw ?? '').trim().toLowerCase()
  t = t.replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/^\[|\]$/g, '')
  if (net.isIP(t)) return { target: t, kind: 'ip' }
  t = t.replace(/:\d+$/, '').replace(/\.$/, '')
  if (/^(?=.{1,253}$)([a-z0-9_]([a-z0-9-_]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(t)) return { target: t, kind: 'domain' }
  return null
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const l = ip.toLowerCase()
  return l === '::1' || l.startsWith('fe80') || l.startsWith('fc') || l.startsWith('fd')
}

async function getJson<T = any>(url: string, timeoutMs = 15000): Promise<{ status: number; data: T | null }> {
  const r = await fetch(url, { headers: { accept: 'application/json, application/rdap+json', 'user-agent': UA }, signal: AbortSignal.timeout(timeoutMs) })
  const text = await r.text()
  try {
    return { status: r.status, data: JSON.parse(text) as T }
  } catch {
    return { status: r.status, data: null }
  }
}

const day = 86_400_000
function fmtDate(iso: string | undefined | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(+d) ? iso : d.toISOString().slice(0, 10)
}
function daysUntil(iso: string): number {
  return Math.floor((+new Date(iso) - Date.now()) / day)
}
const push = (items: OsintItem[], label: string, value: string | null | undefined, tone?: OsintItem['tone']): void => {
  if (value != null && value !== '') items.push({ label, value, ...(tone ? { tone } : {}) })
}

/** Full name from an RDAP entity's jCard. */
function entityName(e: any): string | null {
  const card: any[] = e?.vcardArray?.[1] ?? []
  const fn = card.find((f) => f[0] === 'fn')?.[3]
  const org = card.find((f) => f[0] === 'org')?.[3]
  return (typeof fn === 'string' && fn.trim()) || (typeof org === 'string' && org.trim()) || null
}
function findEntity(entities: any[] | undefined, role: string): any {
  for (const e of entities ?? []) {
    if (e.roles?.includes(role)) return e
    const inner = findEntity(e.entities, role)
    if (inner) return inner
  }
  return null
}

// ---------------------------------------------------------------- sections

async function registration(target: string, kind: 'domain' | 'ip'): Promise<Omit<OsintResult, 'section' | 'target'>> {
  const source = 'RDAP · rdap.org'
  if (kind === 'ip' && isPrivateIp(target)) {
    return { ok: true, source, items: [{ label: 'Scope', value: 'Private / reserved address — not in public registries' }] }
  }
  const { status, data } = await getJson(`https://rdap.org/${kind}/${encodeURIComponent(target)}`)
  if (!data || status >= 400) return { ok: false, source, items: [], error: status === 404 ? 'Not found in the registry' : `Registry answered HTTP ${status}` }
  const items: OsintItem[] = []
  const ev = (a: string): string | undefined => data.events?.find((e: any) => e.eventAction === a)?.eventDate

  if (kind === 'domain') {
    push(items, 'Registrar', entityName(findEntity(data.entities, 'registrar')))
    push(items, 'Registrant', entityName(findEntity(data.entities, 'registrant')))
    const created = ev('registration')
    if (created) push(items, 'Registered', `${fmtDate(created)} · ${Math.floor((Date.now() - +new Date(created)) / (365.25 * day))} yrs ago`)
    const exp = ev('expiration')
    if (exp) {
      const d = daysUntil(exp)
      push(items, 'Expires', `${fmtDate(exp)} · ${d < 0 ? 'expired' : `in ${d} days`}`, d < 0 ? 'bad' : d < 30 ? 'warn' : 'good')
    }
    push(items, 'Updated', fmtDate(ev('last changed')))
    const ds = data.secureDNS?.delegationSigned
    if (ds != null) push(items, 'DNSSEC', ds ? 'Signed' : 'Not signed', ds ? 'good' : 'warn')
    const ns = (data.nameservers ?? []).map((n: any) => String(n.ldhName).toLowerCase())
    push(items, 'Name servers', ns.join(', '))
    push(items, 'Status', (data.status ?? []).join(', '))
  } else {
    push(items, 'Network', [data.name, data.handle].filter(Boolean).join(' · '))
    const cidr = data.cidr0_cidrs?.map((c: any) => `${c.v4prefix ?? c.v6prefix}/${c.length}`).join(', ')
    push(items, 'Range', cidr || (data.startAddress ? `${data.startAddress} – ${data.endAddress}` : null))
    push(items, 'Organisation', entityName(findEntity(data.entities, 'registrant')) ?? entityName(findEntity(data.entities, 'administrative')))
    push(items, 'Abuse contact', entityName(findEntity(data.entities, 'abuse')))
    push(items, 'Country', data.country)
    push(items, 'Registered', fmtDate(ev('registration')))
    push(items, 'Source', data.port43 ? `${data.port43}` : null)
  }
  return { ok: true, source, items }
}

async function dnsSection(target: string): Promise<Omit<OsintResult, 'section' | 'target'>> {
  const source = 'DNS · system resolver'
  const safe = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null)
  const [a, aaaa, mx, ns, txt, caa, dmarc] = await Promise.all([
    safe(dns.resolve4(target)), safe(dns.resolve6(target)), safe(dns.resolveMx(target)), safe(dns.resolveNs(target)),
    safe(dns.resolveTxt(target)), safe(dns.resolveCaa(target)), safe(dns.resolveTxt(`_dmarc.${target}`))
  ])
  const items: OsintItem[] = []
  push(items, 'IPv4', a?.join(', '))
  push(items, 'IPv6', aaaa?.join(', '))
  push(items, 'Mail (MX)', mx?.sort((x, y) => x.priority - y.priority).map((m) => `${m.priority} ${m.exchange}`).join(', '))
  push(items, 'Name servers', ns?.join(', '))
  const txts = (txt ?? []).map((t) => t.join(''))
  const spf = txts.find((t) => /^v=spf1/i.test(t))
  if (mx?.length || spf) {
    push(items, 'SPF', spf ?? 'Missing — anyone can spoof mail from this domain', spf ? (/[-~]all/.test(spf) ? 'good' : 'warn') : 'bad')
    const d = (dmarc ?? []).map((t) => t.join('')).find((t) => /^v=dmarc1/i.test(t))
    const policy = d?.match(/;\s*p=(\w+)/i)?.[1]?.toLowerCase()
    push(items, 'DMARC', d ? `policy ${policy ?? '?'}` : 'Missing', !d ? 'bad' : policy === 'none' ? 'warn' : 'good')
  }
  push(items, 'CAA', caa?.map((c) => `${c.critical ? '!' : ''}${c.issue ? `issue ${c.issue}` : c.issuewild ? `issuewild ${c.issuewild}` : c.iodef ? `iodef ${c.iodef}` : ''}`).join(', '))
  const verifs = txts.filter((t) => !/^v=spf1/i.test(t)).map((t) => t.split(/[=:]/)[0]).filter((k) => k.length < 50)
  push(items, 'TXT records', txts.length ? `${txts.length}${verifs.length ? ` · ${[...new Set(verifs)].slice(0, 6).join(', ')}` : ''}` : null)
  if (!items.length) return { ok: false, source, items, error: 'No DNS records — the domain may not exist' }
  return { ok: true, source, items, ips: [...(a ?? []), ...(aaaa ?? [])] }
}

async function subdomains(target: string): Promise<Omit<OsintResult, 'section' | 'target'>> {
  const names = new Set<string>()
  const used: string[] = []
  const add = (n: string): void => {
    const s = n.trim().toLowerCase().replace(/^\*\./, '')
    if (s === target || s.endsWith(`.${target}`)) names.add(s)
  }
  await Promise.all([
    getJson<any[]>(`https://crt.sh/?q=${encodeURIComponent(`%.${target}`)}&output=json&exclude=expired`, 30000)
      .then(({ data }) => {
        if (!Array.isArray(data)) return
        used.push('crt.sh')
        for (const c of data) String(c.name_value ?? '').split('\n').forEach(add)
      })
      .catch(() => undefined),
    getJson<any[]>(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(target)}&include_subdomains=true&expand=dns_names`, 20000)
      .then(({ data }) => {
        if (!Array.isArray(data)) return
        used.push('Cert Spotter')
        for (const c of data) (c.dns_names ?? []).forEach(add)
      })
      .catch(() => undefined)
  ])
  const source = `Certificate transparency · ${used.join(' + ') || 'crt.sh, Cert Spotter'}`
  if (!used.length) return { ok: false, source, items: [], error: 'Certificate log services did not answer — try again shortly' }
  const list = [...names].sort((x, y) => x.split('.').reverse().join('.').localeCompare(y.split('.').reverse().join('.')))
  return { ok: true, source, items: [{ label: 'Hostnames found', value: String(list.length) }], list }
}

function tlsSection(target: string): Promise<Omit<OsintResult, 'section' | 'target'>> {
  const source = `TLS handshake · ${target}:443`
  return new Promise((resolve) => {
    const sock = tls.connect({ host: target, port: 443, servername: net.isIP(target) ? undefined : target, rejectUnauthorized: false, timeout: 8000 })
    const fail = (msg: string): void => {
      sock.destroy()
      resolve({ ok: false, source, items: [], error: msg })
    }
    sock.on('timeout', () => fail('No answer on port 443'))
    sock.on('error', (e) => fail(/ECONNREFUSED/.test(e.message) ? 'Port 443 is closed — no HTTPS here' : e.message))
    sock.on('secureConnect', () => {
      const c = sock.getPeerCertificate()
      const items: OsintItem[] = []
      const trusted = sock.authorized
      push(items, 'Trust', trusted ? 'Valid & trusted' : `Not trusted — ${String(sock.authorizationError ?? 'unknown')}`, trusted ? 'good' : 'bad')
      push(items, 'Subject', String(c.subject?.CN ?? ''))
      const issuer = [c.issuer?.O, c.issuer?.CN].filter(Boolean).map(String).join(' · ')
      push(items, 'Issuer', issuer)
      // Antivirus / corporate proxies re-sign every site with their own root, hiding the real certificate.
      const interceptor = issuer.match(/norton|avast|avg|kaspersky|eset|bitdefender|mcafee|sophos|zscaler|fortinet|fortigate|netskope|palo alto|forcepoint|blue ?coat|cisco umbrella|trend micro|webroot|f-secure|surfshark|nordvpn|adguard/i)?.[0]
      if (interceptor) {
        push(items, 'Interception', `HTTPS on this PC is inspected by ${interceptor} — this is its certificate, not the site’s real one`, 'warn')
      }
      if (c.valid_to) {
        const d = daysUntil(c.valid_to)
        push(items, 'Expires', `${fmtDate(c.valid_to)} · ${d < 0 ? 'expired' : `in ${d} days`}`, d < 0 ? 'bad' : d < 14 ? 'warn' : 'good')
      }
      push(items, 'Issued', fmtDate(c.valid_from))
      const sans = (c.subjectaltname ?? '').split(',').map((s) => s.trim().replace(/^DNS:/, '')).filter(Boolean)
      push(items, 'Covers', sans.length ? `${sans.slice(0, 4).join(', ')}${sans.length > 4 ? ` +${sans.length - 4} more` : ''}` : null)
      const proto = sock.getProtocol()
      push(items, 'Protocol', proto, proto === 'TLSv1.3' ? 'good' : proto === 'TLSv1.2' ? undefined : 'warn')
      push(items, 'Cipher', sock.getCipher()?.name)
      push(items, 'Key', c.bits ? `${c.bits}-bit${c.asn1Curve ? ` ${c.asn1Curve}` : ''}` : null)
      sock.end()
      resolve({ ok: true, source, items })
    })
  })
}

const SECURITY_HEADERS: [string, string][] = [
  ['strict-transport-security', 'HSTS'],
  ['content-security-policy', 'Content-Security-Policy'],
  ['x-frame-options', 'X-Frame-Options'],
  ['x-content-type-options', 'X-Content-Type-Options'],
  ['referrer-policy', 'Referrer-Policy'],
  ['permissions-policy', 'Permissions-Policy']
]

function webSection(target: string): Promise<Omit<OsintResult, 'section' | 'target'>> {
  const source = `HTTPS response · https://${target}/`
  return new Promise((resolve) => {
    const req = https.request(
      { host: target, path: '/', method: 'GET', timeout: 8000, rejectUnauthorized: false, headers: { 'user-agent': UA, accept: 'text/html' } },
      (res) => {
        res.destroy()
        const h = res.headers
        const items: OsintItem[] = []
        const code = res.statusCode ?? 0
        push(items, 'Status', `${code} ${res.statusMessage ?? ''}`.trim(), code < 400 ? 'good' : 'warn')
        push(items, 'Redirects to', typeof h.location === 'string' ? h.location : null)
        push(items, 'Server', typeof h.server === 'string' ? h.server : null)
        push(items, 'Powered by', typeof h['x-powered-by'] === 'string' ? h['x-powered-by'] : null, 'warn')
        const cdn = h['cf-ray'] ? 'Cloudflare' : h['x-amz-cf-id'] ? 'Amazon CloudFront' : h['x-served-by']?.toString().includes('cache') ? 'Fastly' : h['x-vercel-id'] ? 'Vercel' : h['x-azure-ref'] ? 'Azure Front Door' : h['akamai-grn'] ? 'Akamai' : null
        push(items, 'CDN / edge', cdn)
        for (const [key, name] of SECURITY_HEADERS) push(items, name, h[key] ? 'Present' : 'Missing', h[key] ? 'good' : 'warn')
        resolve({ ok: true, source, items })
      }
    )
    req.on('timeout', () => req.destroy(new Error('No HTTPS response within 8 s')))
    req.on('error', (e) => resolve({ ok: false, source, items: [], error: /ECONNREFUSED/.test(e.message) ? 'Port 443 is closed — no website here' : e.message }))
    req.end()
  })
}

async function ipSection(target: string): Promise<Omit<OsintResult, 'section' | 'target'>> {
  if (isPrivateIp(target)) {
    const ptr = await dns.reverse(target).catch(() => [] as string[])
    const items: OsintItem[] = [{ label: 'Scope', value: 'Private / local address — no public data. Use Network Discovery for LAN devices.' }]
    push(items, 'Reverse DNS', ptr.join(', '))
    return { ok: true, source: 'Local', items }
  }
  const [info, idb, ptr] = await Promise.all([
    getJson(`https://ipinfo.io/${encodeURIComponent(target)}/json`).catch(() => null),
    getJson(`https://internetdb.shodan.io/${encodeURIComponent(target)}`).catch(() => null),
    dns.reverse(target).catch(() => [] as string[])
  ])
  const items: OsintItem[] = []
  const i = info?.data
  push(items, 'Reverse DNS', ptr.join(', ') || i?.hostname)
  push(items, 'Owner / ASN', i?.org)
  push(items, 'Location', [i?.city, i?.region, i?.country].filter(Boolean).join(', '))
  push(items, 'Timezone', i?.timezone)
  if (i?.anycast) push(items, 'Anycast', 'Yes — served from many locations')

  const d = idb?.status === 200 ? idb.data : null
  const list: string[] = []
  if (d) {
    push(items, 'Known open ports', d.ports?.length ? d.ports.join(', ') : 'None seen', d.ports?.length ? undefined : 'good')
    push(items, 'Known CVEs', d.vulns?.length ? `${d.vulns.length} reported` : 'None reported', d.vulns?.length ? 'bad' : 'good')
    push(items, 'Tags', d.tags?.join(', '))
    push(items, 'Software', d.cpes?.map((c: string) => c.replace(/^cpe:\/\w:/, '').replace(/:/g, ' ')).slice(0, 5).join(', '))
    push(items, 'Other hostnames', d.hostnames?.slice(0, 6).join(', '))
    list.push(...(d.vulns ?? []))
  } else if (idb?.status === 404) {
    push(items, 'Known open ports', 'Not in Shodan’s index')
  }
  const sources = [i && 'ipinfo.io', idb && 'Shodan InternetDB'].filter(Boolean).join(' + ')
  if (!items.length) return { ok: false, source: sources || 'ipinfo.io, Shodan InternetDB', items, error: 'IP intelligence services did not answer' }
  return { ok: true, source: sources, items, list: list.length ? list : undefined }
}

export async function osintLookup(section: OsintSection, rawTarget: string): Promise<OsintResult> {
  const norm = normalizeTarget(rawTarget)
  if (!norm) return { section, target: String(rawTarget), ok: false, source: '', items: [], error: 'Enter a domain (example.com) or an IP address' }
  const { target, kind } = norm
  const base = { section, target }
  try {
    switch (section) {
      case 'registration': return { ...base, ...(await registration(target, kind)) }
      case 'dns': return { ...base, ...(await dnsSection(target)) }
      case 'subdomains': return { ...base, ...(await subdomains(target)) }
      case 'tls': return { ...base, ...(await tlsSection(target)) }
      case 'web': return { ...base, ...(await webSection(target)) }
      case 'ip': return { ...base, ...(await ipSection(target)) }
    }
  } catch (e) {
    const msg = (e as Error).name === 'TimeoutError' ? 'Timed out' : (e as Error).message
    return { ...base, ok: false, source: '', items: [], error: msg }
  }
}
