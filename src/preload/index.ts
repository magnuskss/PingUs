import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  OverviewSnapshot, PingResult, DnsLookupResult, DnsRecordType, WifiInfo, WifiNetwork,
  ToolAvailability, HistoryRecord, ModuleId, AppSettings, PortResult, DeviceProfile,
  OsintSection, OsintResult
} from '@shared/types'

const STREAM_CHANNEL = 'pingus:stream'

interface StreamEvent {
  sessionId: string
  type: 'data' | 'progress' | 'done' | 'error'
  payload: unknown
}

export interface StreamHandlers {
  onData?: (payload: unknown) => void
  onProgress?: (payload: { done: number; total: number } | unknown) => void
  onDone?: (payload: unknown) => void
  onError?: (payload: unknown) => void
}

/** Subscribe to a streaming session and return an unsubscribe fn. */
function subscribe(sessionId: string, handlers: StreamHandlers): () => void {
  const listener = (_e: IpcRendererEvent, ev: StreamEvent): void => {
    if (ev.sessionId !== sessionId) return
    switch (ev.type) {
      case 'data': handlers.onData?.(ev.payload); break
      case 'progress': handlers.onProgress?.(ev.payload); break
      case 'done': handlers.onDone?.(ev.payload); break
      case 'error': handlers.onError?.(ev.payload); break
    }
  }
  ipcRenderer.on(STREAM_CHANNEL, listener)
  return () => ipcRenderer.removeListener(STREAM_CHANNEL, listener)
}

const api = {
  // Request/response
  getOverview: (): Promise<OverviewSnapshot> => ipcRenderer.invoke('overview:get'),
  pingOnce: (host: string): Promise<PingResult> => ipcRenderer.invoke('ping:once', host),
  dnsLookup: (host: string, type: DnsRecordType): Promise<DnsLookupResult> =>
    ipcRenderer.invoke('dns:lookup', host, type),
  reverseDns: (ip: string): Promise<string[]> => ipcRenderer.invoke('dns:reverse', ip),
  wifiInfo: (): Promise<WifiInfo> => ipcRenderer.invoke('wifi:info'),
  wifiScan: (): Promise<WifiNetwork[]> => ipcRenderer.invoke('wifi:scan'),
  commonPorts: (): Promise<number[]> => ipcRenderer.invoke('ports:common'),
  detectTools: (): Promise<ToolAvailability> => ipcRenderer.invoke('tools:detect'),
  nmapScan: (host: string, ports: string): Promise<{ results: PortResult[]; raw: string; error?: string }> =>
    ipcRenderer.invoke('nmap:scan', host, ports),
  captureInterfaces: (): Promise<{ id: string; name: string }[]> =>
    ipcRenderer.invoke('packets:interfaces'),

  // OSINT
  osintNormalize: (target: string): Promise<{ target: string; kind: 'domain' | 'ip' } | null> =>
    ipcRenderer.invoke('osint:normalize', target),
  osintLookup: (section: OsintSection, target: string): Promise<OsintResult> =>
    ipcRenderer.invoke('osint:lookup', section, target),

  // Discovery helpers
  wakeOnLan: (mac: string, broadcast?: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('wol:wake', mac, broadcast),
  profileDevice: (
    ip: string,
    mac: string | null,
    hostname: string | null,
    isGateway: boolean
  ): Promise<DeviceProfile> => ipcRenderer.invoke('device:profile', ip, mac, hostname, isGateway),

  // History
  historyList: (filter?: { module?: ModuleId; limit?: number }): Promise<HistoryRecord[]> =>
    ipcRenderer.invoke('history:list', filter),
  historyGet: (id: number): Promise<HistoryRecord | null> => ipcRenderer.invoke('history:get', id),
  historySave: (rec: Omit<HistoryRecord, 'id'>): Promise<HistoryRecord> =>
    ipcRenderer.invoke('history:save', rec),
  historyRemove: (id: number): Promise<void> => ipcRenderer.invoke('history:remove', id),
  historyClear: (): Promise<void> => ipcRenderer.invoke('history:clear'),

  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch),

  // Streaming
  startPing: (host: string, h: StreamHandlers): Promise<{ id: string; stop: () => void }> =>
    ipcRenderer.invoke('ping:start', host).then((id: string) => {
      const unsub = subscribe(id, h)
      return { id, stop: () => { unsub(); ipcRenderer.invoke('stream:stop', id) } }
    }),
  startTrace: (host: string, h: StreamHandlers): Promise<{ id: string; stop: () => void }> =>
    ipcRenderer.invoke('trace:start', host).then((id: string) => {
      const unsub = subscribe(id, h)
      return { id, stop: () => { unsub(); ipcRenderer.invoke('stream:stop', id) } }
    }),
  startDiscovery: (base: string | null, h: StreamHandlers): Promise<{ id: string; stop: () => void }> =>
    ipcRenderer.invoke('discovery:start', base).then((id: string) => {
      const unsub = subscribe(id, h)
      return { id, stop: () => { unsub(); ipcRenderer.invoke('stream:stop', id) } }
    }),
  startPortScan: (host: string, ports: number[], h: StreamHandlers): Promise<{ id: string; stop: () => void }> =>
    ipcRenderer.invoke('ports:start', host, ports).then((id: string) => {
      const unsub = subscribe(id, h)
      return { id, stop: () => { unsub(); ipcRenderer.invoke('stream:stop', id) } }
    }),
  startCapture: (ifaceId: string, filter: string | null, h: StreamHandlers): Promise<{ id: string; stop: () => void }> =>
    ipcRenderer.invoke('packets:start', ifaceId, filter).then((id: string) => {
      const unsub = subscribe(id, h)
      return { id, stop: () => { unsub(); ipcRenderer.invoke('stream:stop', id) } }
    }),
  startPresence: (ips: string[], h: StreamHandlers): Promise<{ id: string; stop: () => void }> =>
    ipcRenderer.invoke('presence:start', ips).then((id: string) => {
      const unsub = subscribe(id, h)
      return { id, stop: () => { unsub(); ipcRenderer.invoke('stream:stop', id) } }
    }),
  startSpeedTest: (h: StreamHandlers): Promise<{ id: string; stop: () => void }> =>
    ipcRenderer.invoke('speedtest:start').then((id: string) => {
      const unsub = subscribe(id, h)
      return { id, stop: () => { unsub(); ipcRenderer.invoke('stream:stop', id) } }
    })
}

export type PingusApi = typeof api

contextBridge.exposeInMainWorld('pingus', api)
