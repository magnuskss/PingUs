import dgram from 'node:dgram'
import http from 'node:http'

/** What a device said about itself in its UPnP/SSDP reply and description XML. */
export interface SsdpInfo {
  ip: string
  server: string | null
  st: string | null
  friendlyName: string | null
  manufacturer: string | null
  modelName: string | null
  deviceType: string | null
}

const SSDP_ADDR = '239.255.255.250'
const SSDP_PORT = 1900
const SEARCH = Buffer.from(
  ['M-SEARCH * HTTP/1.1', `HOST: ${SSDP_ADDR}:${SSDP_PORT}`, 'MAN: "ssdp:discover"', 'MX: 2', 'ST: ssdp:all', '', ''].join('\r\n')
)

function header(msg: string, name: string): string | null {
  const m = msg.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'))
  return m ? m[1].trim() || null : null
}

function xmlTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]{1,200})</${tag}>`, 'i'))
  if (!m) return null
  return m[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim() || null
}

/** Fetch a UPnP description document — only from the device that advertised it, small and fast. */
function fetchDescription(location: string, ip: string): Promise<string | null> {
  let url: URL
  try {
    url = new URL(location)
  } catch {
    return Promise.resolve(null)
  }
  if (url.protocol !== 'http:' || url.hostname !== ip) return Promise.resolve(null)
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 1500 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        return resolve(null)
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c: string) => {
        body += c
        if (body.length > 64_000) req.destroy()
      })
      res.on('end', () => resolve(body))
      res.on('error', () => resolve(body || null))
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(null))
  })
}

/**
 * Ask devices on the local network to announce themselves (SSDP M-SEARCH), then
 * read each responder's UPnP description for its name and model. Only replies
 * from `subnetBase.x` addresses are kept. Resolves after `windowMs`.
 */
export function ssdpSearch(subnetBase: string, windowMs = 3000): Promise<Map<string, SsdpInfo>> {
  return new Promise((resolve) => {
    const found = new Map<string, SsdpInfo>()
    const locations = new Map<string, string>()
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    let finished = false

    const finish = async (): Promise<void> => {
      if (finished) return
      finished = true
      try {
        sock.close()
      } catch {
        /* already closed */
      }
      await Promise.all(
        [...locations].map(async ([ip, loc]) => {
          const xml = await fetchDescription(loc, ip)
          const info = found.get(ip)
          if (!xml || !info) return
          info.friendlyName = xmlTag(xml, 'friendlyName')
          info.manufacturer = xmlTag(xml, 'manufacturer')
          info.modelName = xmlTag(xml, 'modelName')
          info.deviceType = xmlTag(xml, 'deviceType')
        })
      )
      resolve(found)
    }

    sock.on('message', (buf, rinfo) => {
      const ip = rinfo.address
      if (!ip.startsWith(subnetBase + '.')) return
      const msg = buf.toString('utf8')
      const prev = found.get(ip)
      const st = header(msg, 'ST')
      found.set(ip, {
        ip,
        server: prev?.server ?? header(msg, 'SERVER'),
        // Keep the most specific search target (a device URN beats rootdevice/uuid).
        st: prev?.st && /urn:/.test(prev.st) ? prev.st : st,
        friendlyName: null,
        manufacturer: null,
        modelName: null,
        deviceType: null
      })
      const loc = header(msg, 'LOCATION')
      if (loc && !locations.has(ip)) locations.set(ip, loc)
    })
    sock.on('error', () => void finish())
    sock.bind(0, () => {
      const send = (): void => {
        if (!finished) sock.send(SEARCH, SSDP_PORT, SSDP_ADDR, () => {})
      }
      send()
      setTimeout(send, 600)
      setTimeout(() => void finish(), windowMs)
    })
  })
}

/** All the self-description text, for the classifier to match against. */
export function ssdpText(info: SsdpInfo | undefined): string | null {
  if (!info) return null
  const t = [info.friendlyName, info.modelName, info.manufacturer, info.deviceType, info.st, info.server]
    .filter(Boolean)
    .join(' ')
  return t || null
}
