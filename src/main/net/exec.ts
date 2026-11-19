import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process'

export interface ExecResult {
  code: number | null
  stdout: string
  stderr: string
}

/**
 * Run a command with explicit argv (no shell) and collect output.
 * Using argv arrays avoids shell-injection; callers must still validate inputs
 * that originate from the user before passing them here.
 */
export function run(
  command: string,
  args: string[],
  opts: { timeoutMs?: number; options?: SpawnOptionsWithoutStdio } = {}
): Promise<ExecResult> {
  const { timeoutMs = 15000, options } = opts
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    let child
    try {
      child = spawn(command, args, { windowsHide: true, ...options })
    } catch (err) {
      reject(err)
      return
    }

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      resolve({ code: null, stdout, stderr: stderr + '\n[timeout]' })
    }, timeoutMs)

    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

/** Validate a hostname or IPv4/IPv6 literal. Returns trimmed value or null. */
export function sanitizeHost(input: string): string | null {
  const host = input.trim()
  if (!host || host.length > 255) return null
  // hostname (RFC 1123), IPv4, or IPv6 (loose) — reject anything with shell metachars
  const ok = /^[a-zA-Z0-9._:-]+$/.test(host)
  return ok ? host : null
}

/** Validate an IPv4 address. */
export function isIpv4(input: string): boolean {
  const m = input.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  return m.slice(1).every((o) => Number(o) >= 0 && Number(o) <= 255)
}
