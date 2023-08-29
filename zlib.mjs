export function arrayBuffer (u8) {
  // https://stackoverflow.com/questions/37228285/uint8array-to-arraybuffer
  return u8 ? u8.buffer.slice(u8.byteOffset, u8.byteLength + u8.byteOffset) : null
}

export function concat (arrays) {
  // sum of individual array lengths
  const totalLength = arrays.reduce((acc, value) => acc + value.length, 0)
  if (!arrays.length) return null
  const result = new Uint8Array(totalLength)
  let length = 0
  for (const array of arrays) {
    result.set(array, length)
    length += array.length
  }
  return result
}

const encoder = new TextEncoder()

const decoder = new TextDecoder()

/******************************************************* */
// const zlib = require('zlib')
import { gzip, gunzip } from 'zlib'

function gz (u8) {
  return new Promise((resolve, reject) => {
    gzip(u8, (err, buffer) => {
      if (err) reject(err) 
      else resolve(new Uint8Array(buffer))
    })
  })
}

function ungz (u8) {
  return new Promise((resolve, reject) => {
    gunzip(u8, (err, buffer) => {
      if (err) reject(err) 
      else resolve(new Uint8Array(buffer))
    })
  })
}

export async function gzipT (data) { return await gz(encoder.encode(data)) }

export async function ungzipT (data) { return decoder.decode(await ungz(data)) }

export async function gzipB (arg) {
  if (!arg) return null
  // t: 0:binaire, 1:texte zippé, 2:texte non zippé
  const t = typeof arg === 'string' ? (arg.length > 1024 ? 1 : 2) : 0
  let u8 = t ? encoder.encode(arg) : arg
  if (t < 2) u8 = await gz(u8)
  return concat([new Uint8Array([t]), u8])
}

export async function ungzipB (arg) {
  if (!arg || arg.length < 1) return null
  const t = arg[0]
  const c = arg.slice(1)
  const res = t < 2 ? await ungz(c) : c
  return t ? decoder.decode(arrayBuffer(res)) : res
}

/******************************************************* */

const t1 = 'ceci est un très magnifique texte assez court à compresser autant que possible'

function long (n) {
  const t = []
  for (let i = 0; i < n; i++) t.push(t1)
  return t.join('\n')
}

async function main (n) {
  try {
    const l = t1.length + 1
    let g1 = await gzipT(long(1))
    let g2 = await ungzipT(g1)
    console.log(l, g1.length)
    console.log(g2)
    g1 = await gzipT(long(10))
    console.log(10 *l, g1.length)
    g2 = await ungzipT(g1)
    console.log(g2)

    let tl = encoder.encode(long(100))
    g1 = await gzipB(tl)
    g2 = await ungzipB(g1)
    console.log(tl.length, g1.length, g2.length)

    tl = encoder.encode(long(1000))
    g1 = await gzipB(tl)
    g2 = await ungzipB(g1)
    console.log(tl.length, g1.length, g2.length)
  } catch (e) {
      console.log(e)
  }
}

main()
