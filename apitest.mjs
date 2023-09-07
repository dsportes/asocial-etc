// import { AMJ } from './api.mjs'
import { Compteurs } from './api.mjs'

let dh, c, qv, conso, ser
// eslint-disable-next-line no-unused-vars
const GB = 1000000000

async function t1 () {
  dh = Date.UTC(2023, 0, 10, 0, 0, 0)
  console.log('création ' + new Date(dh).toISOString())
  qv = { qc: 1, q1: 1, q2: 2, nn: 100, nc: 20, ng :5, v2: 0}
  c = new Compteurs(null, qv, null, dh)
  ser = c.serial
  c.print()

  dh = Date.UTC(2023, 0, 12, 0, 0, 0)
  console.log('conso 1 ' + new Date(dh).toISOString())
  qv = { qc: 2, q1: 2, q2: 4, nn: 200, nc: 30, ng :5, v2: 0}
  conso = { nl: 100, ne: 20, vd: 10000, vm:30000}
  c = new Compteurs(ser, qv, conso, dh)
  ser = c.serial
  c.print()

  dh = Date.UTC(2023, 6, 18, 0, 0, 0)
  console.log('final ' + new Date(dh).toISOString())
  qv = { qc: 1, q1: 1, q2: 2, nn: 100, nc: 20, ng :5, v2: 0}
  c = new Compteurs(ser, qv, null, dh)
  ser = c.serial
  c.print()

}

import { gzip } from 'zlib'
function gz (u8) {
  return new Promise((resolve, reject) => {
    gzip(u8, (err, buffer) => {
      if (err) reject(err) 
      else resolve(new Uint8Array(buffer))
    })
  })
}

async function test () {
  try {
    t1()
    ser = c.serial
    const ser2 = await gz(ser)
    console.log('serial: ' + ser.length)
    console.log('serial: ' + ser2.length)
  } catch (e) {
    console.log(e)
  }
}

test()
