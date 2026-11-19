import type { HistoryRecord, ModuleId } from '@shared/types'

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown): string => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignore */
  }
}

export async function saveHistory(
  module: ModuleId,
  title: string,
  target: string | null,
  summary: string,
  data: unknown
): Promise<HistoryRecord | null> {
  try {
    const settings = await window.pingus.getSettings()
    if (!settings.autosaveHistory) return null
    return await window.pingus.historySave({
      module,
      title,
      target,
      summary,
      createdAt: Date.now(),
      data: JSON.stringify(data)
    })
  } catch {
    return null
  }
}
