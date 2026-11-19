import {
  LayoutGrid, Activity, Radar, ScanLine, Route, Globe, Gauge, Wifi,
  PackageSearch, MonitorDot, History, Settings, Fingerprint, type LucideIcon
} from 'lucide-react'
import type { ModuleId } from '@shared/types'

export interface NavItem {
  id: ModuleId
  label: string
  short: string
  icon: LucideIcon
  group: 'diagnostics' | 'discovery' | 'data'
}

export const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', short: 'Status', icon: LayoutGrid, group: 'diagnostics' },
  { id: 'ping', label: 'Live Ping', short: 'Latency', icon: Activity, group: 'diagnostics' },
  { id: 'traceroute', label: 'Traceroute', short: 'Routes', icon: Route, group: 'diagnostics' },
  { id: 'dns', label: 'DNS Analyzer', short: 'DNS', icon: Globe, group: 'diagnostics' },
  { id: 'speedtest', label: 'Speed Test', short: 'Speed', icon: Gauge, group: 'diagnostics' },
  { id: 'discovery', label: 'Network Discovery', short: 'Devices', icon: Radar, group: 'discovery' },
  { id: 'ports', label: 'Port Scanner', short: 'Ports', icon: ScanLine, group: 'discovery' },
  { id: 'wifi', label: 'Wi-Fi Analyzer', short: 'Wi-Fi', icon: Wifi, group: 'discovery' },
  { id: 'packets', label: 'Packet Analyzer', short: 'Packets', icon: PackageSearch, group: 'discovery' },
  { id: 'devices', label: 'Device Monitor', short: 'Monitor', icon: MonitorDot, group: 'discovery' },
  { id: 'osint', label: 'OSINT Search', short: 'OSINT', icon: Fingerprint, group: 'discovery' },
  { id: 'history', label: 'History', short: 'History', icon: History, group: 'data' },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: Settings, group: 'data' }
]

export const GROUP_LABELS: Record<NavItem['group'], string> = {
  diagnostics: 'Diagnostics',
  discovery: 'Discovery',
  data: 'Workspace'
}
