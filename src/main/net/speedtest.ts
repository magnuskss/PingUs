import https from 'node:https'
import { performance } from 'node:perf_hooks'
import type { SpeedTestProgress } from '@shared/types'

// Uses Cloudflare's public speed measurement endpoints (speed.cloudflare.com).
const DOWN = (bytes: number): string => `https://speed.cloudflare.com/__down?bytes=${bytes}`
const UP = 'https://speed.cloudflare.com/__up'

/**
 * How the test is run, modelled on how browser speed tests reach gigabit:
 * several connections in parallel (one TCP stream rarely fills a fast line),
 * kept alive so TLS handshakes don't eat into the measurement, run for a fixed
 * time, and the first seconds (TCP slow start) left out of the result.
 */
const DOWN_STREAMS = 12
const UP_STREAMS = 6
const DOWN_MS = 10_000
const UP_MS = 8_000
const WARMUP_MS = 2_000
const TICK_MS = 200
/**
 * Cloudflare rate-limits large downloads per IP (≥10 MB → 429 for about an hour
 * after a few tests), so requests stay small and many; parallel keep-alive
 * streams still fill a gigabit line. If even these are refused, step down.
 */
const DOWN_SIZES = [5_000_000, 2_000_000, 1_000_000]
const UP_REQUEST_BYTES = 25_000_000
const UP_CHUNK = Buffer.alloc(256 * 1024, 0x61)

type Alive = () => boolean

/** Latency = time to first byte of an empty response over a warm, kept-alive connection. */
async function measureLatency(agent: https.Agent, samples = 10): Promise<{ ping: number; jitter: number }> {
  const once = (): Promise<number> =>
    new Promise((resolve, reject) => {
      const start = performance.now()
      const req = https.get(DOWN(0), { agent, timeout: 5000 }, (res) => {
        const t = performance.now() - start
        res.resume()
        res.on('end', () => resolve(t))
      })
      req.on('error', reject)
      req.on('timeout', () => req.destroy(new Error('timeout')))
    })
  const times: number[] = []
  try {
    await once() // opens the connection (DNS + TCP + TLS) — not counted
  } catch {
    /* measured below */
  }
  for (let i = 0; i < samples; i++) {
    try {
      times.push(await once())
    } catch {
      /* skip */
    }
  }
  if (!times.length) return { ping: 0, jitter: 0 }
  times.sort((a, b) => a - b)
  // Median-ish: drop the slowest quarter, which is usually scheduling noise.
  const kept = times.slice(0, Math.max(1, Math.ceil(times.length * 0.75)))
  const ping = kept.reduce((a, b) => a + b, 0) / kept.length
  const jitter = kept.length > 1 ? kept.slice(1).reduce((a, b, i) => a + Math.abs(b - kept[i]), 0) / (kept.length - 1) : 0
  return { ping: Math.round(ping * 10) / 10, jitter: Math.round(jitter * 10) / 10 }
}

/** Shared across the download streams: which request size Cloudflare still accepts. */
interface DownState {
  size: number
  refusedStatus: number | null
  retryAfterS: number | null
}

/** One download stream: keeps pulling responses until the deadline. */
async function downloadStream(
  agent: https.Agent,
  deadline: number,
  alive: Alive,
  count: (n: number) => void,
  dl: DownState
): Promise<void> {
  while (alive() && performance.now() < deadline && dl.size > 0) {
    await new Promise<void>((resolve) => {
      const size = dl.size
      const req = https.get(DOWN(size), { agent, timeout: 15000 }, (res) => {
        if (res.statusCode !== 200) {
          // Refused (429 rate limit / 403): every stream drops to the next smaller size.
          dl.refusedStatus = res.statusCode ?? null
          const ra = Number(res.headers['retry-after'])
          if (Number.isFinite(ra)) dl.retryAfterS = ra
          if (dl.size === size) dl.size = DOWN_SIZES[DOWN_SIZES.indexOf(size) + 1] ?? 0
          res.resume()
          setTimeout(resolve, 100)
          return
        }
        res.on('data', (c: Buffer) => {
          count(c.length)
          if (!alive() || performance.now() >= deadline) req.destroy()
        })
        res.on('end', resolve)
        res.on('close', resolve)
        res.on('error', () => resolve())
      })
      req.on('error', () => setTimeout(resolve, 250))
      req.on('timeout', () => req.destroy())
    })
  }
}

/** One upload stream: writes large POST bodies with backpressure until the deadline. */
async function uploadStream(agent: https.Agent, deadline: number, alive: Alive, count: (n: number) => void): Promise<void> {
  while (alive() && performance.now() < deadline) {
    await new Promise<void>((resolve) => {
      let done = false
      const finish = (): void => {
        if (!done) {
          done = true
          resolve()
        }
      }
      const req = https.request(UP, {
        method: 'POST',
        agent,
        timeout: 15000,
        headers: { 'content-type': 'application/octet-stream', 'content-length': UP_REQUEST_BYTES }
      }, (res) => {
        res.resume()
        res.on('end', finish)
        res.on('error', finish)
      })
      req.on('error', () => setTimeout(finish, 250))
      req.on('timeout', () => req.destroy())
      req.on('close', finish)

      let sent = 0
      const pump = (): void => {
        while (sent < UP_REQUEST_BYTES) {
          if (!alive() || performance.now() >= deadline) {
            req.destroy()
            return
          }
          const chunk = UP_REQUEST_BYTES - sent >= UP_CHUNK.length ? UP_CHUNK : UP_CHUNK.subarray(0, UP_REQUEST_BYTES - sent)
          sent += chunk.length
          // Counted once the chunk is handed to the socket, i.e. actually leaving.
          const ok = req.write(chunk, () => count(chunk.length))
          if (!ok) {
            req.once('drain', pump)
            return
          }
        }
        req.end()
      }
      pump()
    })
  }
}

/**
 * Run `streams` parallel workers for `durationMs`, reporting a rolling 1-second
 * speed while running. Result = average throughput after the warm-up window.
 */
async function measureThroughput(
  durationMs: number,
  streams: number,
  worker: (deadline: number, count: (n: number) => void) => Promise<void>,
  onTick: (mbps: number, frac: number) => void
): Promise<number | null> {
  let total = 0
  const start = performance.now()
  const deadline = start + durationMs
  const samples: { t: number; bytes: number }[] = [{ t: 0, bytes: 0 }]
  const timer = setInterval(() => {
    const t = performance.now() - start
    samples.push({ t, bytes: total })
    const ref = [...samples].reverse().find((s) => t - s.t >= 1000) ?? samples[0]
    const dt = t - ref.t
    if (dt > 0) onTick(((total - ref.bytes) * 8) / (dt / 1000) / 1e6, Math.min(1, t / durationMs))
  }, TICK_MS)

  await Promise.all(Array.from({ length: streams }, () => worker(deadline, (n) => (total += n))))
  clearInterval(timer)
  const end = performance.now() - start
  samples.push({ t: end, bytes: total })
  if (!total) return null

  const from = samples.find((s) => s.t >= WARMUP_MS) ?? samples[0]
  const dt = end - from.t
  if (dt < 500) return Math.round(((total * 8) / (end / 1000) / 1e6) * 10) / 10
  return Math.round((((total - from.bytes) * 8) / (dt / 1000) / 1e6) * 10) / 10
}

export interface SpeedSession {
  stop: () => void
}

export function runSpeedTest(
  onProgress: (p: SpeedTestProgress) => void,
  onDone: (p: SpeedTestProgress) => void,
  onError: (msg: string) => void
): SpeedSession {
  let cancelled = false
  const alive: Alive = () => !cancelled
  const agent = new https.Agent({ keepAlive: true, maxSockets: Math.max(DOWN_STREAMS, UP_STREAMS) + 1 })
  const state: SpeedTestProgress = {
    phase: 'latency', downloadMbps: null, uploadMbps: null, pingMs: null, jitterMs: null, progressPct: 0
  }
  const round = (v: number): number => Math.round(v * 10) / 10

  ;(async () => {
    const lat = await measureLatency(agent)
    if (cancelled) return
    state.pingMs = lat.ping
    state.jitterMs = lat.jitter
    state.phase = 'download'
    state.progressPct = 10
    onProgress({ ...state })

    const dl: DownState = { size: DOWN_SIZES[0], refusedStatus: null, retryAfterS: null }
    const down = await measureThroughput(
      DOWN_MS, DOWN_STREAMS,
      (deadline, count) => downloadStream(agent, deadline, alive, count, dl),
      (mbps, frac) => {
        state.downloadMbps = round(mbps)
        state.progressPct = 10 + Math.round(frac * 45)
        onProgress({ ...state })
      }
    )
    if (cancelled) return
    if (down == null) {
      if (dl.refusedStatus === 429) {
        const wait = dl.retryAfterS ? ` Try again in about ${Math.max(1, Math.round(dl.retryAfterS / 60))} min.` : ''
        throw new Error(`Cloudflare is rate-limiting speed tests from your IP.${wait}`)
      }
      throw new Error(dl.refusedStatus
        ? `The speed test server refused the download (HTTP ${dl.refusedStatus}).`
        : 'Could not reach the speed test server.')
    }
    state.downloadMbps = down

    state.phase = 'upload'
    state.progressPct = 55
    onProgress({ ...state })
    const up = await measureThroughput(
      UP_MS, UP_STREAMS,
      (deadline, count) => uploadStream(agent, deadline, alive, count),
      (mbps, frac) => {
        state.uploadMbps = round(mbps)
        state.progressPct = 55 + Math.round(frac * 44)
        onProgress({ ...state })
      }
    )
    if (cancelled) return
    state.uploadMbps = up

    state.phase = 'done'
    state.progressPct = 100
    onDone({ ...state })
  })()
    .catch((e) => onError((e as Error).message))
    .finally(() => agent.destroy())

  return { stop: () => (cancelled = true) }
}
