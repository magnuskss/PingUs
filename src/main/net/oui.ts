import type { DeviceType, DeviceGuess } from '@shared/types'

/**
 * Curated OUI (MAC vendor prefix) table. This is a best-effort subset of the
 * public IEEE registry covering the devices typically seen on a home or small
 * office LAN — it is a hint, not an authority. Keys are the first three octets
 * in lowercase colon form (e.g. "a4:83:e7"). The optional type is a default
 * guess; ambiguous vendors (Apple, Samsung, Google…) leave it undefined and are
 * refined from the hostname and open ports instead.
 */
interface OuiEntry {
  vendor: string
  type?: DeviceType
}

// prettier-ignore
const OUI: Record<string, OuiEntry> = {}

function add(vendor: string, type: DeviceType | undefined, prefixes: string[]): void {
  for (const p of prefixes) OUI[p] = { vendor, type }
}

// — Apple (Mac / iPhone / iPad / Apple TV — type resolved from hostname) —
add('Apple', undefined, [
  '00:1e:c2', '00:25:00', '00:26:bb', '04:0c:ce', '0c:4d:e9', '10:40:f3', '14:10:9f',
  '18:af:61', '1c:ab:a7', '20:3c:ae', '28:cf:da', '28:e0:2c', '2c:b4:3a', '30:90:ab',
  '34:36:3b', '34:a8:eb', '3c:d0:f8', '40:30:04', '44:d8:84', '48:43:7c', '4c:57:ca',
  '50:ea:d6', '54:26:96', '58:55:ca', '5c:95:ae', '60:03:08', '64:b9:e8', '68:a8:6d',
  '6c:72:e7', '70:11:24', '70:cd:60', '74:e2:f5', '78:31:c1', '78:ca:39', '7c:d1:c3',
  '80:92:9f', '84:38:35', '88:66:a5', '8c:85:90', '90:72:40', '94:94:26', '9c:04:eb',
  'a4:5e:60', 'a4:83:e7', 'a4:c3:61', 'a8:66:7f', 'ac:3c:0b', 'ac:bc:32', 'b0:34:95',
  'b8:09:8a', 'b8:c7:5d', 'bc:92:6b', 'c0:84:7a', 'c8:1e:e7', 'c8:69:cd', 'cc:08:e0',
  'd0:03:4b', 'd4:9a:20', 'dc:0c:5c', 'dc:a9:04', 'e0:ac:cb', 'e4:ce:8f', 'f0:18:98',
  'f0:db:f8', 'f0:f6:1c', 'f4:0f:24', 'f4:37:b7', 'f8:1e:df'
])

// — Samsung (phone / TV / appliance — ambiguous) —
add('Samsung', undefined, [
  '00:1a:8a', '08:37:3d', '0c:14:20', '14:49:e0', '1c:62:b8', '24:4b:81', '2c:ae:2b',
  '34:23:ba', '38:aa:3c', '5c:0a:5b', '68:eb:ae', '78:1f:db', '7c:f8:54', '8c:77:12',
  '94:35:0a', 'a0:07:98', 'ac:5f:3e', 'b4:3a:28', 'bc:14:85', 'c8:19:f7', 'd0:17:6a',
  'e4:40:e2', 'e8:50:8b', 'f8:04:2e', 'fc:a1:3e'
])

// — Google (Nest / Chromecast / Pixel) —
add('Google', undefined, [
  '00:1a:11', '20:df:b9', '3c:5a:b4', '54:60:09', '6c:ad:f8', '94:eb:2c', 'a4:77:33',
  'da:a1:19', 'f4:f5:d8', 'f4:f5:e8', '48:d6:d5', '1c:f2:9a', 'e4:f0:42'
])

// — Amazon (Echo / Fire / Kindle) —
add('Amazon', undefined, [
  '40:b4:cd', '44:65:0d', '50:dc:e7', '68:37:e9', '68:54:fd', '74:c2:46', '84:d6:d0',
  'a0:02:dc', 'ac:63:be', 'b0:fc:0d', 'f0:27:2d', 'fc:a6:67'
])

// — Microsoft (Xbox / Surface / Hyper-V) —
add('Microsoft', 'computer', [
  '00:12:5a', '00:15:5d', '00:17:fa', '00:1d:d8', '00:50:f2', '28:18:78', '30:59:b7',
  '50:1a:c5', '58:82:a8', '7c:1e:52', '7c:ed:8d', '98:5f:d3', 'b4:ae:2b', 'bc:83:85',
  'c0:33:5e', 'dc:98:40', 'e4:fa:ed'
])

// — Intel wireless / wired NICs → a PC or laptop —
add('Intel', 'computer', [
  '00:1b:21', '00:21:6a', '34:41:5d', '3c:a9:f4', '44:85:00', '50:76:af', '68:05:ca',
  '7c:5c:f8', '94:65:9c', '94:c6:91', 'a0:a8:cd', 'ac:fd:ce', 'e4:a4:71', 'f8:63:3f'
])

// — Dell —
add('Dell', 'computer', [
  '00:14:22', '18:03:73', '18:66:da', '24:b6:fd', '34:17:eb', '44:a8:42', '5c:f9:dd',
  '84:7b:eb', 'b8:ac:6f', 'd0:67:e5', 'f8:bc:12'
])

// — HP (PCs; printers refined by port 9100) —
add('HP', 'computer', [
  '00:1b:78', '3c:d9:2b', '70:5a:0f', '9c:b6:54', 'a0:b3:cc', 'ec:8e:b5', '00:17:a4',
  '10:60:4b', '2c:23:3a', '30:e1:71', '38:ea:a7', '94:57:a5', 'b0:5a:da', 'd4:c9:ef'
])

// — Lenovo —
add('Lenovo', 'computer', ['00:59:07', '54:ee:75', '6c:5f:1c', '70:72:0d', 'a4:8c:db', 'c8:5b:76', 'e8:61:7e'])

// — ASUS (routers / PCs; default router) —
add('ASUS', 'router', [
  '04:d4:c4', '08:60:6e', '2c:56:dc', '38:d5:47', '50:46:5d', '60:45:cb', '70:4d:7b',
  'ac:22:0b', 'bc:ee:7b', 'd0:17:c2', 'f0:2f:74', 'f8:32:e4'
])

// — Routers / access points —
add('TP-Link', 'router', [
  '14:cc:20', '50:c7:bf', '54:af:97', '60:32:b1', 'a4:2b:b0', 'b0:48:7a', 'c0:06:c3',
  'c4:6e:1f', 'd8:07:b6', 'e8:de:27', 'f4:ec:38', 'f8:1a:67', 'ac:84:c6', '54:a7:03',
  '5c:62:8b', '98:da:c4'
])
add('Netgear', 'router', [
  '00:1b:2f', '04:a1:51', '08:02:8e', '20:e5:2a', '28:c6:8e', '44:94:fc', '6c:b0:ce',
  '9c:3d:cf', 'a0:40:a0', 'b0:7f:b9', 'c0:3f:0e', 'c4:04:15', 'dc:ef:09', 'e0:46:9a'
])
add('Ubiquiti', 'router', [
  '00:15:6d', '04:18:d6', '24:5a:4c', '44:d9:e7', '68:d7:9a', '74:83:c2', '78:8a:20',
  '80:2a:a8', 'b4:fb:e4', 'dc:9f:db', 'e0:63:da', 'f0:9f:c2', 'fc:ec:da'
])
add('Linksys', 'router', ['00:1a:70', '00:21:29', '00:25:9c', '20:aa:4b', '48:f8:b3', '58:6d:8f', '68:7f:74'])
add('D-Link', 'router', ['00:1b:11', '00:26:5a', '14:d6:4d', '28:10:7b', '5c:d9:98', '78:54:2e', '84:c9:b2', 'c8:be:19'])
add('MikroTik', 'router', ['08:55:31', '2c:c8:1b', '48:8f:5a', '64:d1:54', '6c:3b:6b', '74:4d:28', 'cc:2d:e0', 'e4:8d:8c'])

// — Raspberry Pi (DIY computer / server) —
add('Raspberry Pi', 'computer', ['28:cd:c1', 'b8:27:eb', 'd8:3a:dd', 'dc:a6:32', 'e4:5f:01'])

// — Espressif (ESP8266 / ESP32 — DIY smart-home / IoT) —
add('Espressif', 'iot', [
  '24:0a:c4', '24:6f:28', '30:ae:a4', '3c:61:05', '48:3f:da', '5c:cf:7f', '68:c6:3a',
  '7c:9e:bd', '84:f3:eb', '8c:aa:b5', 'a4:cf:12', 'b4:e6:2d', 'bc:dd:c2', 'cc:50:e3',
  'd8:f1:5b', 'ec:fa:bc'
])

// — Printers —
add('Brother', 'printer', ['00:1b:a9', '00:80:77', '08:00:37', '30:05:5c', 'b4:22:00'])
add('Canon', 'printer', ['00:00:85', '2c:9e:fc', '88:87:17', 'e0:bb:9e'])
add('Epson', 'printer', ['00:00:48', '00:26:ab', '44:d2:44', '64:eb:8c', 'a4:ee:57'])

// — Media / speakers / TV —
add('Sonos', 'speaker', ['00:0e:58', '34:7e:5c', '48:a6:b8', '5c:aa:fd', '78:28:ca', '94:9f:3e', 'b8:e9:37', 'f0:f6:c1'])
add('Roku', 'tv', ['00:0d:4b', '88:de:a9', 'ac:3a:7a', 'b0:a7:37', 'b8:3e:59', 'cc:6d:a0', 'd0:4d:2c', 'dc:3a:5e'])
add('LG', 'tv', ['00:1c:62', '00:e0:91', '10:68:3f', '2c:54:cf', '3c:bd:d8', '58:a2:b5', 'a8:16:b2', 'c4:36:6c', 'e8:5b:5b'])
add('Vizio', 'tv', ['00:19:9d', '2c:64:1f', '3c:28:6d', 'b8:e4:56', 'c4:12:f5'])

// — Consoles —
add('Sony', 'console', ['00:04:1f', '00:13:15', '00:19:c5', '00:24:8d', '28:0d:fc', '70:9e:29', '78:c8:81', 'bc:60:a7', 'fc:0f:e6'])
add('Nintendo', 'console', [
  '00:09:bf', '00:17:ab', '00:19:1d', '00:1a:e9', '00:1b:ea', '00:1e:35', '00:1f:32',
  '00:21:bd', '00:22:aa', '00:24:1e', '00:25:a0', '04:03:d6', '18:2a:7b', '2c:10:c1',
  '34:af:2c', '58:bd:a3', '5c:52:1e', '7c:bb:8a', '98:b6:e9', 'b8:8a:ec', 'e0:e7:51'
])

// — Smart home / cameras / NAS —
add('Philips Hue', 'iot', ['00:17:88', 'ec:b5:fa'])
add('Ring', 'camera', ['00:62:6e', '34:3e:a4', '54:e0:19', 'b0:09:da', 'f0:72:ea'])
add('Wyze', 'camera', ['2c:aa:8e', '7c:78:b2', 'd0:3f:27'])
add('Hikvision', 'camera', ['44:19:b6', '4c:bd:8f', 'bc:ad:28', 'c0:56:e3'])
add('Synology', 'nas', ['00:11:32', '90:09:d0'])
add('QNAP', 'nas', ['00:08:9b', '24:5e:be'])
add('TUYA', 'iot', ['10:5a:17', '18:69:d8', '50:8a:06', '68:57:2d', '84:e3:42', 'd8:1f:12', 'ec:b5:fa'])

/** Normalise any MAC form to a lowercase "aa:bb:cc" OUI prefix, or null. */
function ouiPrefix(mac: string | null | undefined): string | null {
  if (!mac) return null
  const hex = mac.toLowerCase().replace(/[^0-9a-f]/g, '')
  if (hex.length < 6) return null
  return `${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4, 6)}`
}

/** Locally-administered / randomised MAC (privacy MAC) — vendor is meaningless. */
export function isRandomMac(mac: string | null | undefined): boolean {
  const prefix = ouiPrefix(mac)
  if (!prefix) return false
  const firstByte = parseInt(prefix.slice(0, 2), 16)
  return (firstByte & 0x02) === 0x02
}

/** Look up the hardware vendor for a MAC, or null when unknown. */
export function lookupVendor(mac: string | null | undefined): string | null {
  const prefix = ouiPrefix(mac)
  if (!prefix) return null
  if (OUI[prefix]) return OUI[prefix].vendor
  if (isRandomMac(mac)) return 'Private address'
  return null
}

const HOSTNAME_RULES: [RegExp, DeviceType][] = [
  [/iphone/i, 'phone'],
  [/ipad/i, 'tablet'],
  [/(macbook|imac|mac-?mini|mac-?pro|mac-?studio)/i, 'computer'],
  [/(appletv|apple-tv)/i, 'tv'],
  [/(android|pixel|oneplus|xiaomi|redmi|huawei|galaxy|sm-[a-z])/i, 'phone'],
  [/(desktop|-pc|windows|laptop|notebook|thinkpad|surface)/i, 'computer'],
  [/(router|gateway|modem|-ap|accesspoint|unifi|openwrt|dd-wrt|fritz|archer|deco)/i, 'router'],
  [/(printer|print|-hp|officejet|laserjet|envy|ecotank|brother|epson|canon)/i, 'printer'],
  [/(tv|bravia|roku|firetv|fire-tv|chromecast|shield|webos|aquos)/i, 'tv'],
  [/(echo|alexa|sonos|homepod|speaker|nest-audio|nest-mini)/i, 'speaker'],
  [/(cam|camera|doorbell|ring-|wyze|hikvision|dahua|reolink)/i, 'camera'],
  [/(xbox|playstation|ps4|ps5|switch|nintendo)/i, 'console'],
  [/(nas|synology|qnap|diskstation|truenas|freenas)/i, 'nas'],
  [/(server|srv|proxmox|esxi|docker|-vm)/i, 'server'],
  [/(raspberry|raspberrypi|rpi|-pi)/i, 'computer'],
  [/(bulb|plug|switch|sensor|thermostat|hue|tuya|shelly|tasmota|smart-)/i, 'iot']
]

/** Map a set of open ports to a device type signal, if any. */
function typeFromPorts(ports: number[] | undefined): DeviceType | null {
  if (!ports || !ports.length) return null
  const has = (p: number): boolean => ports.includes(p)
  if (has(9100) || has(515) || (has(631) && !has(22))) return 'printer'
  if (has(554) || has(8554) || has(37777)) return 'camera'
  if (has(32400) || has(8096) || has(5000) || has(548)) return 'nas'
  if (has(8009) || has(7000) || has(1400)) return 'tv'
  if (has(1883) || has(8883)) return 'iot'
  if (has(3389) || has(445) || has(5900)) return 'computer'
  return null
}

/** Rules for the text a device announces over UPnP/SSDP (server header, model, device type URN). */
const UPNP_RULES: [RegExp, DeviceType][] = [
  [/InternetGatewayDevice|WANDevice/i, 'router'],
  [/Microsoft-Windows/i, 'computer'],
  [/(MediaRenderer|dial-multiscreen|\btv\b|television|tizen|webos|bravia|roku|firetv|aquos|vidaa|androidtv|google ?tv)/i, 'tv'],
  [/(sonos|ZonePlayer|speaker|soundbar|denon|heos|bose|yamaha)/i, 'speaker'],
  [/(printer|PrintBasic|officejet|laserjet|epson|brother|canon)/i, 'printer'],
  [/(xbox|playstation|nintendo)/i, 'console'],
  [/(synology|qnap|diskstation|nas\b|MediaServer)/i, 'nas'],
  [/(camera|ipcam|hikvision|dahua|reolink|DigitalSecurityCamera)/i, 'camera'],
  [/(hue|bridge|shelly|tasmota|tuya|wemo)/i, 'iot']
]

/** Ambiguous vendors: what a *real* (non-private) MAC from them usually is. */
const VENDOR_HINTS: Record<string, [DeviceType, string]> = {
  // Phones from these vendors hide behind private Wi-Fi addresses by default,
  // so a real vendor MAC points at the vendor's other hardware.
  Apple: ['computer', 'Apple hardware address — iPhones usually hide theirs, so likely a Mac or Apple TV'],
  Samsung: ['tv', 'Samsung hardware address — Galaxy phones usually hide theirs, so likely a TV or appliance'],
  Google: ['tv', 'Google hardware address — likely a Chromecast or Nest device'],
  Amazon: ['speaker', 'Amazon hardware address — likely an Echo or Fire TV']
}

export interface DeviceSignals {
  mac?: string | null
  hostname?: string | null
  isGateway?: boolean
  openPorts?: number[]
  /** TTL of a ping reply from the same subnet (unchanged by hops). */
  ttl?: number | null
  /** Text the device announced over UPnP/SSDP: server header, friendly name, model, device URN. */
  upnp?: string | null
}

/** OS family from a same-subnet ping TTL: 64 ≈ Apple/Linux/Android, 128 ≈ Windows, 255 ≈ firmware. */
function osFromTtl(ttl: number | null | undefined): 'unix' | 'windows' | 'embedded' | null {
  if (ttl == null) return null
  if (ttl <= 64) return 'unix'
  if (ttl <= 128) return 'windows'
  return 'embedded'
}

/**
 * Guess what a device is from every signal we have, strongest first:
 * gateway → UPnP announcement → hostname → vendor → open ports → private MAC + TTL
 * → ambiguous vendor → TTL alone → unknown. Always a guess; `reason` says why.
 */
export function inferDeviceType(s: DeviceSignals): DeviceGuess {
  if (s.isGateway) return { type: 'router', confidence: 'high', reason: 'Default gateway of this network' }

  if (s.upnp) {
    for (const [re, type] of UPNP_RULES) {
      if (re.test(s.upnp)) return { type, confidence: 'high', reason: 'Announces itself over UPnP' }
    }
  }

  if (s.hostname) {
    for (const [re, type] of HOSTNAME_RULES) {
      if (re.test(s.hostname)) return { type, confidence: 'high', reason: `Hostname "${s.hostname}"` }
    }
  }

  const prefix = ouiPrefix(s.mac)
  const entry = prefix ? OUI[prefix] : undefined
  if (entry?.type) return { type: entry.type, confidence: 'medium', reason: `${entry.vendor} hardware` }

  const portType = typeFromPorts(s.openPorts)
  if (portType) return { type: portType, confidence: 'medium', reason: 'Services it exposes' }

  const os = osFromTtl(s.ttl)
  if (isRandomMac(s.mac)) {
    if (os === 'windows') {
      return { type: 'laptop', confidence: 'low', reason: 'Private Wi-Fi address + Windows reply — likely a laptop' }
    }
    return {
      type: 'phone',
      confidence: 'low',
      reason: 'Private Wi-Fi address (phones and tablets use these by default)'
    }
  }

  if (entry && VENDOR_HINTS[entry.vendor]) {
    const [type, reason] = VENDOR_HINTS[entry.vendor]
    return { type, confidence: 'low', reason }
  }

  if (os === 'windows') return { type: 'computer', confidence: 'low', reason: 'Replies like Windows (TTL 128)' }
  if (os === 'embedded') return { type: 'iot', confidence: 'low', reason: 'Replies like embedded firmware (TTL 255)' }
  if (os === 'unix') {
    return { type: 'unknown', confidence: 'low', reason: 'Replies like Linux / Apple / Android (TTL 64) — not enough to tell more' }
  }
  return { type: 'unknown', confidence: 'low', reason: 'No identifying signals' }
}
