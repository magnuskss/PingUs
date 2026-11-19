import { run } from './exec'
import type { ToolAvailability } from '@shared/types'

async function has(command: string, args: string[]): Promise<boolean> {
  try {
    const r = await run(command, args, { timeoutMs: 4000 })
    return r.code === 0 || (r.stdout + r.stderr).length > 0
  } catch {
    return false
  }
}

export async function detectTools(
  overrides: { nmapPath?: string | null; tsharkPath?: string | null } = {}
): Promise<ToolAvailability> {
  const nmap = await has(overrides.nmapPath || 'nmap', ['--version'])
  const tshark = await has(overrides.tsharkPath || 'tshark', ['--version'])
  return { nmap, tshark }
}
