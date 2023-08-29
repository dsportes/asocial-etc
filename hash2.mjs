import { toByteArray, fromByteArray } from './base64.mjs'

function u8ToB64 (u8, url) {
  const s = fromByteArray(u8)
  return !url ? s : s.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function b64ToU8 (s) {
  const diff = s.length % 4
  let x = s
  if (diff) {
    const pad = '===='.substring(0, 4 - diff)
    x = s + pad
  }
  return toByteArray(x.replace(/-/g, '+').replace(/_/g, '/'))
}

function writeUInt32LE (u8, value, offset) {
  value = +value
  offset = offset >>> 0
  u8[offset + 3] = (value >>> 24)
  u8[offset + 2] = (value >>> 16)
  u8[offset + 1] = (value >>> 8)
  u8[offset] = (value & 0xff)
  return offset + 4
}

const max32 = BigInt(2 ** 32)
function bigToU8 (n) {
  if (typeof n === 'number') n = BigInt(n)
  if (n < 0) n = -n
  const buf = new Uint8Array(8)
  writeUInt32LE(buf, Number(n / max32), 4)
  writeUInt32LE(buf, Number(n % max32), 0)
  return buf
}

function readUInt32LE (u8, offset) {
  offset = offset >>> 0
  return ((u8[offset]) |
      (u8[offset + 1] << 8) |
      (u8[offset + 2] << 16)) +
      (u8[offset + 3] * 0x1000000)
}

const BI_MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER)
function u8ToBig (u8, number = false) {
  const fort = BigInt(readUInt32LE(u8, 4))
  const faible = BigInt(readUInt32LE(u8, 0))
  const r = (fort * max32) + faible
  return number && r < BI_MAX_SAFE_INTEGER ? Number(r) : r
}

function u8ToInt (u8) {
  if (!u8 || !u8.length || u8.length > 8) return 0
  let r = 0n
  for (let i = u8.length - 1; i > 0; i--) {
    r += BigInt(u8[i]) * (p2b[i - 1] + 1n)
  }
  r += BigInt(u8[0])
  return r > BI_MAX_SAFE_INTEGER ? r : Number(r)
}

const p2 = [255, (256 ** 2) - 1, (256 ** 3) - 1, (256 ** 4) - 1, (256 ** 5) - 1, (256 ** 6) - 1, (256 ** 7) - 1]
const p2b = [255n, (256n ** 2n) - 1n, (256n ** 3n) - 1n, (256n ** 4n) - 1n, (256n ** 5n) - 1n, (256n ** 6n) - 1n, (256n ** 7n) - 1n]
function intToU8 (n) {
  const bi = typeof n === 'bigint'
  if (n < 0) n = -n
  const p2x = bi ? p2b : p2
  let l = 8
  for (let i = 6; i >= 0; i--, l--) if (n > p2x[i]) break
  const u8 = new Uint8Array(l)
  for (let i = 0; i < 8; i++) {
    u8[i] = bi ? Number(n % 256n) : n % 256
    n = bi ? (n / 256n) : Math.floor(n / 256)
  }
  return u8
}

export function sidToId (id) {
  return u8ToInt(b64ToU8(id, true)) // b64 -> buffer
}

export function idToSid (id) { // to string (b64)
  if (typeof id === 'string') return id // déjà en B64
  if (typeof id === 'number') return u8ToB64(intToU8(id), true) // int -> u8 -> b64
  return u8ToB64(id, true) // u8 -> b64
}
