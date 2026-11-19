import { run } from './exec'
import type { WifiInfo, WifiNetwork } from '@shared/types'

function channelToBand(channel: number | null): string | null {
  if (channel == null) return null
  if (channel >= 1 && channel <= 14) return '2.4 GHz'
  if (channel >= 32 && channel <= 177) return '5 GHz'
  if (channel >= 1 && channel <= 233) return '6 GHz'
  return null
}

/** Current Wi-Fi connection via `netsh wlan show interfaces`. */
export async function getWifiInfo(): Promise<WifiInfo> {
  const empty: WifiInfo = {
    connected: false, ssid: null, bssid: null, signalPct: null, signalDbm: null,
    channel: null, band: null, radioType: null, rxRateMbps: null, txRateMbps: null,
    authentication: null
  }
  try {
    const r = await run('netsh', ['wlan', 'show', 'interfaces'], { timeoutMs: 6000 })
    const text = r.stdout
    const get = (label: string): string | null => {
      const m = text.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im'))
      return m ? m[1].trim() : null
    }
    const state = get('State')
    // Exact match — "disconnected" also contains "connected".
    if (!state || !/^connected$/i.test(state)) return empty
    const signalStr = get('Signal')
    const signalPct = signalStr ? Number(signalStr.replace('%', '')) : null
    // Approx dBm from quality %: dBm = (pct/2) - 100
    const signalDbm = signalPct != null ? Math.round(signalPct / 2 - 100) : null
    const channelStr = get('Channel')
    const channel = channelStr ? Number(channelStr) : null
    const rx = get('Receive rate \\(Mbps\\)')
    const tx = get('Transmit rate \\(Mbps\\)')
    const bandRaw = get('Band')
    return {
      connected: true,
      ssid: get('SSID'),
      bssid: get('BSSID'),
      signalPct,
      signalDbm,
      channel,
      band: bandRaw ?? channelToBand(channel),
      radioType: get('Radio type'),
      rxRateMbps: rx ? Number(rx) : null,
      txRateMbps: tx ? Number(tx) : null,
      authentication: get('Authentication')
    }
  } catch {
    return empty
  }
}

/** Nearby networks via `netsh wlan show networks mode=bssid`. */
export async function scanWifiNetworks(): Promise<WifiNetwork[]> {
  try {
    const r = await run('netsh', ['wlan', 'show', 'networks', 'mode=bssid'], { timeoutMs: 8000 })
    const nets: WifiNetwork[] = []
    let currentSsid: string | null = null
    let currentAuth: string | null = null
    for (const line of r.stdout.split(/\r?\n/)) {
      const ssidM = line.match(/^SSID\s+\d+\s*:\s*(.*)$/i)
      if (ssidM) {
        currentSsid = ssidM[1].trim() || '(hidden)'
        currentAuth = null
        continue
      }
      const authM = line.match(/^\s*Authentication\s*:\s*(.+)$/i)
      if (authM) currentAuth = authM[1].trim()
      const bssidM = line.match(/^\s*BSSID\s+\d+\s*:\s*([0-9a-fA-F:]+)/i)
      if (bssidM && currentSsid != null) {
        nets.push({
          ssid: currentSsid,
          bssid: bssidM[1],
          signalPct: null,
          channel: null,
          band: null,
          authentication: currentAuth
        })
      }
      const sigM = line.match(/^\s*Signal\s*:\s*(\d+)%/i)
      if (sigM && nets.length) nets[nets.length - 1].signalPct = Number(sigM[1])
      const chM = line.match(/^\s*Channel\s*:\s*(\d+)/i)
      if (chM && nets.length) {
        const last = nets[nets.length - 1]
        last.channel = Number(chM[1])
        last.band = last.band ?? channelToBand(Number(chM[1]))
      }
      // Windows reports the band directly (needed for 6 GHz, whose channel numbers overlap 2.4 GHz).
      const bandM = line.match(/^\s*Band\s*:\s*(.+)$/i)
      if (bandM && nets.length) nets[nets.length - 1].band = bandM[1].trim()
    }
    return nets
  } catch {
    return []
  }
}
