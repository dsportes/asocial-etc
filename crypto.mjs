// const crypto = require('crypto')
import { randomBytes } from 'crypto'

const p2 = [255, (256 ** 2) - 1, (256 ** 3) - 1, (256 ** 4) - 1, (256 ** 5) - 1, (256 ** 6) - 1, (256 ** 7) - 1]

function rnd6 () {
  const u8 = randomBytes(6)
  let r = u8[0]
  for (let i = 5; i > 0; i--) r += u8[i] * (p2[i - 1] + 1)
  return r
}

/* retourne un code à 6 lettres majuscules depuis l'id d'un ticket */
export function idTkToL6 (t) {
  const am = Math.floor(t / d10)
  const m = am % 100
  const a = Math.floor(am / 100)
  let x = String.fromCharCode(a % 2 === 0 ? 64 + m : 76 + m)
  for (let i = 0, j = (t % d10); i < 5; i++) { x += String.fromCharCode(65 + (j % 26)); j = Math.floor(j / 26) }
  return x
}

/* Génère l'id d'un ticket: aa mm rrr rrr rrr r */
const d10 = 10000000000
export function genIdTk (a, m) {
  const x1 = (((a % 100) * 100) + m)
  return (rnd6() % d10) + (x1 * d10)
}

/* Retourne l'année et le mois depuis un code à 6 lettres */
export function amDeL6 (l6) {
  const a = new Date().getFullYear()
  const pa = a % 2
  const c = l6.charCodeAt(0) - 64
  const [p, m] = c > 12 ? [1, c - 12] : [0, c]
  return [p === pa ? a : a - 1, m]
}

{
  const t = genIdTk(2022, 1)
  const l6 = idTkToL6(t)
  console.log(t, l6, amDeL6(l6))
}
{
  const t = genIdTk(2023, 1)
  const l6 = idTkToL6(t)
  console.log(t, l6, amDeL6(l6))
}
{
  const t = genIdTk(2022, 12)
  const l6 = idTkToL6(t)
  console.log(t, l6, amDeL6(l6))
}
