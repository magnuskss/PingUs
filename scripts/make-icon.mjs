// Generates build/icon.png (512) and build/icon.ico (16–256) from the PingUs
// mark, using only Node built-ins. Run: node scripts/make-icon.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

// Mark in a 24-unit box (same geometry as the in-app logo).
const TRI = [[2, 21], [2, 13], [10, 21]]
const LINE = [[5, 11], [8, 11], [10, 6], [14, 18], [16.5, 11], [22, 11]]
const STROKE = 1.9

function inTri(px, py) {
  const [[ax, ay], [bx, by], [cx, cy]] = TRI
  const d = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3)
  const d1 = d(px, py, ax, ay, bx, by), d2 = d(px, py, bx, by, cx, cy), d3 = d(px, py, cx, cy, ax, ay)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}
function segDist(px, py, [x1, y1], [x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}
function onLine(px, py) {
  for (let i = 0; i < LINE.length - 1; i++) if (segDist(px, py, LINE[i], LINE[i + 1]) <= STROKE / 2) return true
  return false
}

function render(size) {
  const SS = 4, px = Buffer.alloc(size * size * 4)
  const radius = size * 0.2, pad = size * 0.16, unit = (size - 2 * pad) / 24
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0, fg = 0
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const fx = x + (sx + 0.5) / SS, fy = y + (sy + 0.5) / SS
        // rounded-square tile
        const qx = Math.max(radius - fx, 0, fx - (size - radius)), qy = Math.max(radius - fy, 0, fy - (size - radius))
        if (qx * qx + qy * qy > radius * radius) continue
        bg++
        const ux = (fx - pad) / unit, uy = (fy - pad) / unit
        if (inTri(ux, uy) || onLine(ux, uy)) fg++
      }
      const n = SS * SS, a = bg / n, f = bg ? fg / bg : 0
      const v = Math.round(10 + f * (245 - 10)) // #0a0a0a → #f5f5f5
      const o = (y * size + x) * 4
      px[o] = px[o + 1] = px[o + 2] = v
      px[o + 3] = Math.round(a * 255)
    }
  }
  return png(size, px)
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0 }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
function ico(images) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4)
  let offset = 6 + images.length * 16
  const dir = images.map(({ size, data }) => {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size; e[1] = size >= 256 ? 0 : size
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([head, ...dir, ...images.map((i) => i.data)])
}

mkdirSync('build', { recursive: true })
writeFileSync('build/icon.png', render(512))
writeFileSync('build/icon.ico', ico([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, data: render(size) }))))
console.log('wrote build/icon.png and build/icon.ico')
