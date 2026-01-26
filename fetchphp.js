/* eslint-disable no-unused-vars */
import { encode, decode } from '@msgpack/msgpack'
const decoder = new TextDecoder()

const url = 'http://localhost:43097/op.php'
const data = {
  'key1': 'value1',
  'key2': 2
}

const resp = await fetch(url,
  {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'no-cors', // no-cors, *cors, same-origin
    headers: {
      'Content-Type': 'application/octet-stream',  // sent request
      'Accept':       'application/octet-stream'   // expected data sent back
    },
    body: encode( data ), // body data type must match "Content-Type" header
  }
)
console.log(resp.status, resp.statusText, resp.bodyUsed)
const hdr = resp.headers
const buf = new Uint8Array(await resp.arrayBuffer())
console.log(resp.status, resp.statusText, resp.bodyUsed)
const v = decode(buf)
console.log(JSON.stringify(v)); // parses JSON response into native JavaScript objects
