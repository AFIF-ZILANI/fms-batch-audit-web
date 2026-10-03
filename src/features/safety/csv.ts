// CSV + a store-only (no compression) zip writer, so no dependency is needed.

type Cell = string | number | boolean | null | undefined

function cell(v: Cell): string {
  if (v == null) return ""
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** UTF-8 BOM first so Excel reads ৳ and Bangla correctly. Headers come from `columns` or the first row's keys. */
export function toCsv(rows: Record<string, Cell>[], columns?: string[]): string {
  const cols = columns ?? Object.keys(rows[0] ?? {})
  const lines = [cols, ...rows.map((r) => cols.map((c) => r[c]))]
  return "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n"
}

export function download(blob: Blob, filename: string) {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(b: Uint8Array): number {
  let c = 0xffffffff
  for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Store-only zip of text files (UTF-8 names and content). */
export function zip(files: { name: string; content: string }[]): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1 // fixed timestamp; irrelevant for CSVs
  for (const f of files) {
    const name = enc.encode(f.name)
    const data = enc.encode(f.content)
    const crc = crc32(data)
    // Fields shared by the local header (at 4) and the central directory entry (at 6).
    const common = (v: DataView, o: number) => {
      v.setUint16(o, 20, true) // version needed
      v.setUint16(o + 2, 0x0800, true) // UTF-8 names
      v.setUint16(o + 4, 0, true) // method: stored
      v.setUint16(o + 6, 0, true) // time
      v.setUint16(o + 8, dosDate, true)
      v.setUint32(o + 10, crc, true)
      v.setUint32(o + 14, data.length, true)
      v.setUint32(o + 18, data.length, true)
      v.setUint16(o + 22, name.length, true)
    }
    const local = new Uint8Array(30)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    common(lv, 4)
    const cd = new Uint8Array(46)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true) // version made by
    common(cv, 6)
    cv.setUint32(42, offset, true)
    parts.push(local, name, data)
    central.push(cd, name)
    offset += local.length + name.length + data.length
  }
  const end = new Uint8Array(22)
  const v = new DataView(end.buffer)
  v.setUint32(0, 0x06054b50, true)
  v.setUint16(8, files.length, true)
  v.setUint16(10, files.length, true)
  v.setUint32(12, central.reduce((n, p) => n + p.length, 0), true)
  v.setUint32(16, offset, true)
  return new Blob([...parts, ...central, end], { type: "application/zip" })
}
