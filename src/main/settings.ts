import { app } from 'electron'
import { join } from 'node:path'
import fs from 'node:fs'
import type { AppSettings } from '@shared/types'

const DEFAULTS: AppSettings = {
  pingIntervalMs: 1000,
  pingTimeoutMs: 2000,
  theme: 'dark',
  autosaveHistory: true,
  nmapPath: null,
  tsharkPath: null,
  authorizedOnly: true
}

let cache: AppSettings | null = null

function file(): string {
  return join(app.getPath('userData'), 'pingus-settings.json')
}

export function getSettings(): AppSettings {
  if (cache) return cache
  try {
    if (fs.existsSync(file())) {
      cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) }
    } else {
      cache = { ...DEFAULTS }
    }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache ?? { ...DEFAULTS }
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  cache = next
  try {
    fs.writeFileSync(file(), JSON.stringify(next, null, 2))
  } catch {
    /* ignore */
  }
  return next
}
