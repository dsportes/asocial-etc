/* eslint-disable no-unused-vars */
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const u8m1 = new Uint8Array([255, 255, 255])
const u8m2 = new Uint8Array([])

try {
  const x1 = new Uint8Array(encoder.encode(null)) // lg 4
  const x1b = decoder.decode(x1) // 'null'
  const x2 = new Uint8Array(encoder.encode('')) // lg 0
  const x2b = decoder.decode(x2) // ''
  // const x3 = decoder.decode(null) // exc
  const x5 = decoder.decode(u8m1) // '???'
  const x6 = decoder.decode(u8m2) // ''
  console.log('done')
} catch (e) {
  console.log(e)
}
