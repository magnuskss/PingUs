import { spawn } from 'node:child_process'
import { run } from './exec'

export interface CaptureInterface {
  id: string
  name: string
}

export interface PacketRow {
  no: number
  time: string
  src: string
  dst: string
  protocol: string
  length: number
  info: string
}

/** List capture interfaces via `tshark -D`. */
export async function listCaptureInterfaces(tsharkPath = 'tshark'): Promise<CaptureInterface[]> {
  try {
    const r = await run(tsharkPath, ['-D'], { timeoutMs: 8000 })
    const out: CaptureInterface[] = []
    for (const line of r.stdout.split(/\r?\n/)) {
      // "1. \Device\NPF_{GUID} (Ethernet)"
      const m = line.match(/^\s*(\d+)\.\s+(\S+)\s*(?:\((.+)\))?/)
      if (m) out.push({ id: m[1], name: m[3] || m[2] })
    }
    return out
  } catch {
    return []
  }
}

export interface CaptureSession {
  stop: () => void
}

/**
 * Live capture via tshark, emitting parsed rows. Uses -T fields for a stable,
 * parseable format. An optional BPF-style filter restricts capture.
 */
export function startCapture(
  ifaceId: string,
  filter: string | null,
  onPacket: (p: PacketRow) => void,
  onError: (msg: string) => void,
  tsharkPath = 'tshark'
): CaptureSession {
  const args = [
    '-i', ifaceId,
    '-l',
    '-n',
    '-T', 'fields',
    '-E', 'separator=\t',
    '-e', 'frame.number',
    '-e', 'frame.time_relative',
    '-e', 'ip.src',
    '-e', 'ip.dst',
    '-e', '_ws.col.Protocol',
    '-e', 'frame.len',
    '-e', '_ws.col.Info'
  ]
  // Only allow a conservative capture filter (letters, numbers, spaces, basic ops)
  if (filter && /^[a-zA-Z0-9 ._:/()=<>!&|-]+$/.test(filter)) {
    args.push('-f', filter)
  }

  let child
  try {
    child = spawn(tsharkPath, args, { windowsHide: true })
  } catch (e) {
    queueMicrotask(() => onError((e as Error).message))
    return { stop: () => {} }
  }

  let buf = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    buf += chunk.toString()
    const lines = buf.split(/\r?\n/)
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const f = line.split('\t')
      if (f.length < 7 || !f[0]) continue
      onPacket({
        no: Number(f[0]) || 0,
        time: f[1] || '',
        src: f[2] || '',
        dst: f[3] || '',
        protocol: f[4] || '',
        length: Number(f[5]) || 0,
        info: f[6] || ''
      })
    }
  })
  child.stderr?.on('data', (c: Buffer) => {
    const s = c.toString()
    if (/permission|denied|npf|error/i.test(s)) onError(s.trim())
  })
  child.on('error', (err) => onError(err.message))
  return { stop: () => child.kill() }
}
