// import { AMJ } from './api.mjs'
import { Compteurs } from './api.mjs'

let dh, c, qv, ser
// eslint-disable-next-line no-unused-vars
const GB = 1000000000

async function t1 () {
  dh = Date.UTC(2023, 0, 10, 0, 0, 0)
  console.log(new Date(dh).toISOString())
  qv = { qc: 1, q1: 1, q2: 2, nn: 100, nc: 20, ng :5, v2: 0}
  c = new Compteurs(null, qv, null, dh)
  ser = c.serial
  c.print()

  dh = Date.UTC(2023, 0, 12, 0, 0, 0)
  console.log(new Date(dh).toISOString())
  qv = { qc: 1, q1: 1, q2: 2, nn: 200, nc: 30, ng :5, v2: 0}
  c = new Compteurs(ser, qv, null, dh)
  ser = c.serial
  c.print()

  dh = Date.UTC(2023, 0, 18, 0, 0, 0)
  console.log(new Date(dh).toISOString())
  qv = { qc: 1, q1: 1, q2: 2, nn: 100, nc: 20, ng :5, v2: 0}
  c = new Compteurs(ser, qv, null, dh)
  ser = c.serial
  c.print()

}

async function test () {
  try {
    t1()
  } catch (e) {
    console.log(e)
  }
}

test()
