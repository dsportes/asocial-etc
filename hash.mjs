import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const crypto = require('crypto')

import { idToSid, sidToId } from './hash2.mjs'

console.log(Number.MAX_SAFE_INTEGER - 3, (Number.MAX_SAFE_INTEGER - 3) % 4)

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

/* retourne un safe integer hash du string ou du u8 */
function hash (arg) {
  const t = typeof arg
  const bin = t !== 'string'
  // https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0, ch; i < arg.length; i++) {
    ch = bin ? arg[i] : arg.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (bin ? + ((h1 >> 2) << 2) : (h1 >>> 0))
}

function hash2 (str, big = false, b64 = false, seed = 0) {
  // https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const r = big ? 4294967296n * BigInt(h2) + BigInt(h1) : 4294967296 * (2097151 & h2) + (h1 >>> 0)
  // if (Number.isSafeInteger(r)) { console.log(r) }
  return b64 ? int2base64(r) : r
}

function hashBin (str) {
  // https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0, ch; i < str.length; i++) {
    ch = str[i]
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + ((h1 >> 2) << 2)
}


for (let i = 0; i < 5; i++) {
  const rb = crypto.randomBytes(32)
  const hb = hash(rb)
  const hb2 = hashBin(rb)
  console.log(hb, hb % 4, hb2)
}

console.log(hash('toto est beau'))
console.log(hash2('toto est beau'))

const BI_MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER)
function u8ToInt (u8) {
  if (!u8 || !u8.length || u8.length > 8) return 0
  let r = 0
  for (let i = u8.length - 1; i > 0; i--) {
    // r += BigInt(u8[i]) * (p2b[i - 1] + 1n)
    r += u8[i] * (p2[i - 1] + 1)
  }
  // r += BigInt(u8[0])
  r += u8[0]
  return r
}

const p2 = [255, (256 ** 2) - 1, (256 ** 3) - 1, (256 ** 4) - 1, (256 ** 5) - 1, (256 ** 6) - 1, (256 ** 7) - 1]
const p2b = [255n, (256n ** 2n) - 1n, (256n ** 3n) - 1n, (256n ** 4n) - 1n, (256n ** 5n) - 1n, (256n ** 6n) - 1n, (256n ** 7n) - 1n]
function intToU8 (n) {
  if (n < 0) n = -n
  let l = 8
  for (let i = 6; i >= 0; i--, l--) if (n > p2[i]) break
  const u8 = new Uint8Array(l)
  for (let i = 0; i < 8; i++) {
    u8[i] = n % 256
    n = Math.floor(n / 256)
  }
  return u8
}

const c64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const rc64 = new Array(256)
for (let i = 0; i < c64.length; i++) rc64[c64.charCodeAt(i)] = i

export function intToB64 (n) {
  return u8ToB64(intToU8(n), true)
  /*
  let r = '', x = n
  while (x > 0) { r += c64.charAt(x % 64); x = Math.floor(x / 64) }
  return r
  */
}

export function b64ToInt (s) {
  return u8ToInt(b64ToU8(s, true))
  /*
  let n = 0
  for (let i = s.length - 1; i >= 0; i--) { n += rc64[s.charCodeAt(i)]; if (i) n = n * 64 }
  return n
  */
}

function rnd6 () {
  const u8 = crypto.randomBytes(6)
  let r = u8[0]
  for (let i = 5; i > 0; i--) r += u8[i] * (p2[i - 1] + 1)
  const r2 = u8ToInt(u8)
  console.log(r, r2)
  return r
}

const IDCOMPTABLE = 9007199254740988

const n1 = rnd6()
const n1b = intToB64(n1)
const n2 = b64ToInt(n1b)
const n1x = idToSid(n1)

console.log(n1, n1b, n2, n1x)

const n3b = intToB64(IDCOMPTABLE)
const n3 = b64ToInt(n3b)
const n3x = idToSid(n1)

console.log(IDCOMPTABLE, n3b, n3)

const n3c = idToSid(IDCOMPTABLE)
const n3y = sidToId(n3c)

console.log(IDCOMPTABLE, n3c, n3y)