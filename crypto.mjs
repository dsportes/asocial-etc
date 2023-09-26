// const crypto = require('crypto')
import { randomBytes } from 'crypto'

const p2 = [255, (256 ** 2) - 1, (256 ** 3) - 1, (256 ** 4) - 1, (256 ** 5) - 1, (256 ** 6) - 1, (256 ** 7) - 1]

function rnd6 () {
  const u8 = randomBytes(6)
  let r = u8[0]
  for (let i = 5; i > 0; i--) r += u8[i] * (p2[i - 1] + 1)
  return r
}

function iToL6 (n) {
  let x = ''
  for (let i = 0, j = n; i < 6; i++) { x = String.fromCharCode(65 + (j % 26)) + x; j = Math.floor(j / 26) }
  return x
}

function l6ToI (s) {
  let n = 0
  for (let i = 0; i < 6; i++) { n = (n * 26) + (i < s.length ? (s.charCodeAt(i) - 65) : 65) }
  return n
}

function genTk (a, m) {
  const l = iToL6(rnd6())
  const c = String.fromCharCode(a % 2 === 0 ? 64 + m : 76 + m)
  return c + l.substring(1)
}

function mDeTk (t) {
  const c = t.charCodeAt(0) - 65
  return c > 12 ? [1, c - 11] : [0, c + 1]
}

const t = genTk(2020, 1)
const b = l6ToI(t)
const c = iToL6(b)
const d = l6ToI(c)
const [a, m] = mDeTk(t)
console.log(t, b, c, d, a, m)
