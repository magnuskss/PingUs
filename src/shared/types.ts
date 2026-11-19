// Shared types used across main, preload and renderer processes.

export type ModuleId =
  | 'overview'
  | 'ping'
  | 'discovery'
  | 'ports'
  | 'traceroute'
  | 'dns'
  | 'speedtest'
  | 'wifi'
  | 'packets'
  | 'devices'
  | 'osint'
  | 'history'
  | 'settings'

// ---------- OSINT (passive public-record lookups on a domain or IP) ----------
export type OsintSection = 'registration' | 'dns' | 'subdomains' | 'tls' | 'web' | 'ip'

export interface OsintItem {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad'
}

export interface OsintResult {
  section: OsintSection
  target: string
  ok: boolean
  error?: string
  /** Where the data came from, shown on the card. */
  source: string
  items: OsintItem[]
  /** Long lists (subdomains, open ports, CVEs). */
  list?: string[]
  /** Addresses a domain resolved to — lets the page pivot into IP lookups. */
  ips?: string[]
}

export interface NetworkInterfaceInfo {
  name: string
  address: string
  netmask: string
  mac: string
  family: 'IPv4' | 'IPv6'
  internal: boolean
  cidr: string | null
}

export interface OverviewSnapshot {
  hostname: string
  platform: string
  online: boolean
  publicIp: string | null
  gateway: string | null
  dnsServers: string[]
  primaryInterface: NetworkInterfaceInfo | null
  interfaces: NetworkInterfaceInfo[]
  gatewayLatencyMs: number | null
  internetLatencyMs: number | null
}

export interface PingResult {
  seq: number
  timestamp: number
  host: string
  success: boolean
  latencyMs: number | null
  ttl: number | null
  error?: string
}

export interface PingStats {
  sent: number
  received: number
  lost: number
  lossPct: number
  minMs: number | null
  maxMs: number | null
  avgMs: number | null
  jitterMs: number | null
}

export interface TracerouteHop {
  hop: number
  host: string | null
  ip: string | null
  latenciesMs: (number | null)[]
  avgMs: number | null
}

export type DeviceType =
  | 'router'
  | 'computer'
  | 'laptop'
  | 'phone'
  | 'tablet'
  | 'printer'
  | 'tv'
  | 'console'
  | 'speaker'
  | 'camera'
  | 'nas'
  | 'server'
  | 'iot'
  | 'unknown'

/** How sure the classifier is, and the evidence it used — always a guess. */
export interface DeviceGuess {
  type: DeviceType
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export interface DiscoveredDevice {
  ip: string
  mac: string | null
  hostname: string | null
  vendor: string | null
  deviceType: DeviceType
  confidence: DeviceGuess['confidence']
  reason: string
  /** TTL of the ping reply — hints at the OS family (64 ≈ Apple/Linux/Android, 128 ≈ Windows). */
  ttl: number | null
  /** Name the device announces itself with over UPnP/SSDP (e.g. "Living Room TV"). */
  friendlyName?: string | null
  model?: string | null
  reachable: boolean
  latencyMs: number | null
  isGateway: boolean
  isSelf: boolean
  firstSeen: number
  lastSeen: number
  openPorts?: number[]
  type: 'arp' | 'ping'
}

/** A lightweight presence tick emitted by the live watcher. */
export interface PresenceUpdate {
  ip: string
  reachable: boolean
  latencyMs: number | null
  lastSeen: number
}

/** Result of profiling a single device for the services it exposes. */
export interface DeviceProfile {
  ip: string
  openPorts: number[]
  deviceType: DeviceType
  confidence: DeviceGuess['confidence']
  reason: string
}

export interface PortResult {
  port: number
  state: 'open' | 'closed'
  service: string | null
  latencyMs: number | null
}

export type DnsRecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME' | 'SOA' | 'PTR'

export interface DnsLookupResult {
  type: DnsRecordType
  name: string
  records: string[]
  error?: string
  durationMs: number
}

export interface WifiInfo {
  connected: boolean
  ssid: string | null
  bssid: string | null
  signalPct: number | null
  signalDbm: number | null
  channel: number | null
  band: string | null
  radioType: string | null
  rxRateMbps: number | null
  txRateMbps: number | null
  authentication: string | null
}

export interface WifiNetwork {
  ssid: string
  bssid: string | null
  signalPct: number | null
  channel: number | null
  band: string | null
  authentication: string | null
}

export interface SpeedTestProgress {
  phase: 'latency' | 'download' | 'upload' | 'done'
  downloadMbps: number | null
  uploadMbps: number | null
  pingMs: number | null
  jitterMs: number | null
  progressPct: number
}

export interface ToolAvailability {
  nmap: boolean
  tshark: boolean
}

export interface HistoryRecord {
  id: number
  module: ModuleId
  title: string
  target: string | null
  createdAt: number
  summary: string
  data: string // JSON blob
}

export interface AppSettings {
  pingIntervalMs: number
  pingTimeoutMs: number
  theme: 'dark'
  autosaveHistory: boolean
  nmapPath: string | null
  tsharkPath: string | null
  authorizedOnly: boolean
}

export interface Channels {
  stream: string
}
