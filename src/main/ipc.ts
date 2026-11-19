import { ipcMain, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { getOverview } from './net/overview'
import { pingOnce, pingContinuous } from './net/ping'
import { traceroute } from './net/traceroute'
import { dnsLookup, reverseDns } from './net/dns'
import { discoverDevices, watchPresence } from './net/discovery'
import { scanPorts, nmapScan, profilePorts, COMMON_PORTS } from './net/ports'
import { wakeOnLan } from './net/wol'
import { inferDeviceType } from './net/oui'
import { getWifiInfo, scanWifiNetworks } from './net/wifi'
import { runSpeedTest } from './net/speedtest'
import { listCaptureInterfaces, startCapture } from './net/packets'
import { detectTools } from './net/tools'
import { osintLookup, normalizeTarget } from './net/osint'
import { getStore } from './db'
import { getSettings, setSettings } from './settings'
import type { DnsRecordType, HistoryRecord, ModuleId, DeviceProfile, OsintSection } from '@shared/types'

export const STREAM_CHANNEL = 'pingus:stream'

interface StreamEvent {
  sessionId: string
  type: 'data' | 'progress' | 'done' | 'error'
  payload: unknown
}

// Active streaming sessions keyed by id so the renderer can stop them.
const sessions = new Map<string, { stop: () => void }>()

function emit(wc: WebContents, ev: StreamEvent): void {
  if (!wc.isDestroyed()) wc.send(STREAM_CHANNEL, ev)
}

export function registerIpc(): void {
  // ---- Request / response ----
  ipcMain.handle('overview:get', () => getOverview())
  ipcMain.handle('ping:once', (_e, host: string) => pingOnce(String(host)))
  ipcMain.handle('dns:lookup', (_e, host: string, type: DnsRecordType) =>
    dnsLookup(String(host), type)
  )
  ipcMain.handle('dns:reverse', (_e, ip: string) => reverseDns(String(ip)))
  ipcMain.handle('wifi:info', () => getWifiInfo())
  ipcMain.handle('wifi:scan', () => scanWifiNetworks())
  ipcMain.handle('ports:common', () => COMMON_PORTS)
  ipcMain.handle('tools:detect', async () => {
    const s = getSettings()
    return detectTools({ nmapPath: s.nmapPath, tsharkPath: s.tsharkPath })
  })
  ipcMain.handle('nmap:scan', (_e, host: string, ports: string) => {
    const s = getSettings()
    return nmapScan(String(host), String(ports), s.nmapPath || 'nmap')
  })
  ipcMain.handle('packets:interfaces', () => {
    const s = getSettings()
    return listCaptureInterfaces(s.tsharkPath || 'tshark')
  })

  // ---- OSINT ----
  const OSINT_SECTIONS: OsintSection[] = ['registration', 'dns', 'subdomains', 'tls', 'web', 'ip']
  ipcMain.handle('osint:normalize', (_e, target: string) => normalizeTarget(String(target)))
  ipcMain.handle('osint:lookup', (_e, section: OsintSection, target: string) => {
    if (!OSINT_SECTIONS.includes(section)) throw new Error('Unknown OSINT section')
    return osintLookup(section, String(target))
  })

  // ---- Discovery helpers: Wake-on-LAN + device profiling ----
  ipcMain.handle('wol:wake', (_e, mac: string, broadcast?: string) =>
    wakeOnLan(String(mac), broadcast ? String(broadcast) : undefined)
  )
  ipcMain.handle(
    'device:profile',
    async (_e, ip: string, mac: string | null, hostname: string | null, isGateway: boolean): Promise<DeviceProfile> => {
      const openPorts = await profilePorts(String(ip))
      const guess = inferDeviceType({ mac, hostname, isGateway: !!isGateway, openPorts })
      return { ip: String(ip), openPorts, deviceType: guess.type, confidence: guess.confidence, reason: guess.reason }
    }
  )

  // ---- History ----
  ipcMain.handle('history:list', (_e, filter?: { module?: ModuleId; limit?: number }) =>
    getStore().list(filter)
  )
  ipcMain.handle('history:get', (_e, id: number) => getStore().get(Number(id)))
  ipcMain.handle('history:save', (_e, rec: Omit<HistoryRecord, 'id'>) => getStore().insert(rec))
  ipcMain.handle('history:remove', (_e, id: number) => getStore().remove(Number(id)))
  ipcMain.handle('history:clear', () => getStore().clear())

  // ---- Settings ----
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch) => setSettings(patch))

  // ---- Streaming: start returns a sessionId ----
  ipcMain.handle('ping:start', (e, host: string) => {
    const id = randomUUID()
    const wc = e.sender
    const session = pingContinuous(String(host), (r) =>
      emit(wc, { sessionId: id, type: 'data', payload: r })
    )
    sessions.set(id, session)
    return id
  })

  ipcMain.handle('trace:start', (e, host: string) => {
    const id = randomUUID()
    const wc = e.sender
    const session = traceroute(
      String(host),
      (hop) => emit(wc, { sessionId: id, type: 'data', payload: hop }),
      (err) => {
        emit(wc, { sessionId: id, type: err ? 'error' : 'done', payload: err ?? null })
        sessions.delete(id)
      }
    )
    sessions.set(id, session)
    return id
  })

  ipcMain.handle('discovery:start', (e, base: string | null) => {
    const id = randomUUID()
    const wc = e.sender
    const session = discoverDevices(
      (d) => emit(wc, { sessionId: id, type: 'data', payload: d }),
      (done, total) => emit(wc, { sessionId: id, type: 'progress', payload: { done, total } }),
      (err) => {
        emit(wc, { sessionId: id, type: err ? 'error' : 'done', payload: err ?? null })
        sessions.delete(id)
      },
      base
    )
    sessions.set(id, session)
    return id
  })

  ipcMain.handle('presence:start', (e, ips: string[]) => {
    const id = randomUUID()
    const wc = e.sender
    const list = Array.isArray(ips) ? ips.map(String) : []
    const session = watchPresence(list, (u) =>
      emit(wc, { sessionId: id, type: 'data', payload: u })
    )
    sessions.set(id, session)
    return id
  })

  ipcMain.handle('ports:start', (e, host: string, ports: number[]) => {
    const id = randomUUID()
    const wc = e.sender
    const list = Array.isArray(ports) && ports.length ? ports.map(Number) : COMMON_PORTS
    const session = scanPorts(
      String(host),
      list,
      (r) => emit(wc, { sessionId: id, type: 'data', payload: r }),
      (done, total) => emit(wc, { sessionId: id, type: 'progress', payload: { done, total } }),
      (err) => {
        emit(wc, { sessionId: id, type: err ? 'error' : 'done', payload: err ?? null })
        sessions.delete(id)
      }
    )
    sessions.set(id, session)
    return id
  })

  ipcMain.handle('packets:start', (e, ifaceId: string, filter: string | null) => {
    const id = randomUUID()
    const wc = e.sender
    const s = getSettings()
    const session = startCapture(
      String(ifaceId),
      filter ? String(filter) : null,
      (p) => emit(wc, { sessionId: id, type: 'data', payload: p }),
      (msg) => {
        emit(wc, { sessionId: id, type: 'error', payload: msg })
      },
      s.tsharkPath || 'tshark'
    )
    sessions.set(id, session)
    return id
  })

  ipcMain.handle('speedtest:start', (e) => {
    const id = randomUUID()
    const wc = e.sender
    const session = runSpeedTest(
      (p) => emit(wc, { sessionId: id, type: 'progress', payload: p }),
      (p) => {
        emit(wc, { sessionId: id, type: 'done', payload: p })
        sessions.delete(id)
      },
      (msg) => {
        emit(wc, { sessionId: id, type: 'error', payload: msg })
        sessions.delete(id)
      }
    )
    sessions.set(id, session)
    return id
  })

  // ---- Stop any streaming session ----
  ipcMain.handle('stream:stop', (_e, id: string) => {
    const s = sessions.get(id)
    if (s) {
      s.stop()
      sessions.delete(id)
    }
    return true
  })
}

export function stopAllSessions(): void {
  for (const s of sessions.values()) s.stop()
  sessions.clear()
}
