/**
 * Generates PNG icons for the PWA manifest.
 * Pure Node.js — no external dependencies needed.
 * Brand: purple gradient circle (#7c3aed → #5b21b6) with a white chat-bubble icon.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── CRC-32 ────────────────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const t = Buffer.from(type, 'latin1')
  const crcInput = Buffer.concat([t, data])
  const out = Buffer.alloc(4 + 4 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  t.copy(out, 4)
  data.copy(out, 8)
  out.writeUInt32BE(crc32(crcInput), 8 + data.length)
  return out
}

// ── draw helpers ──────────────────────────────────────────────────────────────
function lerp(a, b, t) { return Math.round(a + (b - a) * t) }

function makePNG(size) {
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2

  // Brand colors
  const C1 = [124, 58, 237]   // #7c3aed
  const C2 = [91, 33, 182]    // #5b21b6

  // Chat-bubble path (scaled 0-1 → 0-size):
  // Simple rounded rectangle with a small triangle at bottom-left.
  const padPct = 0.22   // padding around the icon region
  const pad = size * padPct

  const rows = []
  for (let y = 0; y < size; y++) {
    const row = [0] // PNG filter: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > radius) {
        // outside — transparent
        row.push(0, 0, 0, 0)
        continue
      }

      // gradient background
      const t = dist / radius
      const R = lerp(C1[0], C2[0], t)
      const G = lerp(C1[1], C2[1], t)
      const B = lerp(C1[2], C2[2], t)

      // Draw white chat bubble
      const nx = (x - pad) / (size - 2 * pad)  // 0-1 inside padded area
      const ny = (y - pad) / (size - 2 * pad)

      const isBubble = isInsideChatBubble(nx, ny, size)

      if (isBubble) {
        row.push(255, 255, 255, 230) // white
      } else {
        row.push(R, G, B, 255)
      }
    }
    rows.push(...row)
  }

  const imageData = deflateSync(Buffer.from(rows))

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // RGBA
  // compression=0, filter=0, interlace=0

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', imageData),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

function isInsideChatBubble(nx, ny, size) {
  // Rounded rect: occupies roughly 0.1-0.9 x, 0.05-0.75 y
  const rx1 = 0.08, rx2 = 0.92
  const ry1 = 0.05, ry2 = 0.78
  const cornerR = 0.15

  // inside main rounded rect
  const inRect =
    nx >= rx1 && nx <= rx2 &&
    ny >= ry1 && ny <= ry2

  if (!inRect) {
    // tail triangle: bottom-left area
    const tx1 = 0.08, tx2 = 0.38, ty1 = 0.72, ty2 = 0.98
    if (nx >= tx1 && nx <= tx2 && ny >= ty1 && ny <= ty2) {
      // slope: right-going from bottom-left corner
      const slope = (tx2 - tx1) / (ty2 - ty1)
      const boundX = tx2 - (ny - ty1) * slope
      return nx <= boundX
    }
    return false
  }

  // round corners
  const corners = [
    [rx1 + cornerR, ry1 + cornerR],
    [rx2 - cornerR, ry1 + cornerR],
    [rx2 - cornerR, ry2 - cornerR],
    [rx1 + cornerR, ry2 - cornerR],
  ]
  for (const [cx2, cy2] of corners) {
    if (nx < rx1 + cornerR || nx > rx2 - cornerR) {
      if (ny < ry1 + cornerR || ny > ry2 - cornerR) {
        const dd = Math.hypot(nx - cx2, ny - cy2)
        if (
          ((nx < rx1 + cornerR && ny < ry1 + cornerR && cx2 === corners[0][0] && cy2 === corners[0][1]) ||
           (nx > rx2 - cornerR && ny < ry1 + cornerR && cx2 === corners[1][0] && cy2 === corners[1][1]) ||
           (nx > rx2 - cornerR && ny > ry2 - cornerR && cx2 === corners[2][0] && cy2 === corners[2][1]) ||
           (nx < rx1 + cornerR && ny > ry2 - cornerR && cx2 === corners[3][0] && cy2 === corners[3][1]))
          && dd > cornerR
        ) return false
      }
    }
  }

  // Three dots inside bubble
  const dotY = 0.44
  const dotR = 0.07
  const dots = [0.28, 0.50, 0.72]
  for (const dotX of dots) {
    if (Math.hypot(nx - dotX, ny - dotY) < dotR) return false // hole (background shows)
  }

  return true
}

// ── main ─────────────────────────────────────────────────────────────────────
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const outDir = join(__dirname, '../public/icons')

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

for (const sz of SIZES) {
  const png = makePNG(sz)
  const out = join(outDir, `icon-${sz}x${sz}.png`)
  writeFileSync(out, png)
  console.log(`✓  icon-${sz}x${sz}.png  (${png.length} bytes)`)
}

// Also copy 192 as apple-touch-icon
writeFileSync(join(__dirname, '../public/apple-touch-icon.png'), makePNG(180))
console.log('✓  apple-touch-icon.png')
console.log('\nDone! Icons written to public/icons/')
