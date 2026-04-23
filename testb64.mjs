import { toByteArray, fromByteArray } from './base64.mjs'

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function str2ab(str) {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) bufView[i] = str.charCodeAt(i)
  return buf
}

function keyToB64(key) {
  return window.btoa(ab2str(key))
}

function keyFromB64 (key) { // BEST-200-2000-20000
  return str2ab(window.atob(key))
}

function random (nbytes) {
  const u8 = new Uint8Array(nbytes)
  window.crypto.getRandomValues(u8)
  return u8
}

function toUrl1 (s) {
  return s.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function toUrl2 (s) { // BEST-200-2000-20000
  let i = s.length
  for(; s.charAt(i) === '='; i--) {}
  const x = s.substring(0, i).replace(/\+/g, '-').replace(/\//g, '_')
  return x
}

function fromUrl (s) { // BEST-200-2000-20000
  return s.replace(/-/g, '+').replace(/_/g, '/') + '===='.substring(0, 4 - s.length % 4)
  // return s.replaceAll('-', '+').replace('_', '/') + '===='.substring(0, 4 - s.length % 4)
}

function fromUrl1 (s) {
  // return s.replace(/-/g, '+').replace(/_/g, '/') + '===='.substring(0, 4 - s.length % 4)
  const x = s.replaceAll('-', '+').replace('_', '/') + '===='.substring(0, 4 - s.length % 4)
  return x
}

function fromUrl2 (s) {
  return s.replace(/-/g, '+').replace(/_/g, '/').replace(/g/g, '')
}

function u8ToB64 (u8) { return fromByteArray(u8)}
function b64ToU8 (s) { return toByteArray(s) } // BEST-200-2000-20000 (de peu)

function base64ToBytes(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

function bytesToBase64(bytes) {
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte),
  ).join("");
  return btoa(binString);
}

let bin1 = random(200)
let n = 1000000
let s
let b

function t1 () {
  let t0 = Date.now()
  for(let i = 0; i < n; i++) s = u8ToB64(bin1)
  let t1 = Date.now()
  console.log('u8ToB64', t1 - t0)
  for(let i = 0; i < n; i++) b = b64ToU8(s)
  t0 = Date.now()
  console.log('b64ToU8', t0 - t1)

  for(let i = 0; i < n; i++) s = keyToB64(bin1)
  t1 = Date.now()
  console.log('keyToB64', t1 - t0)
  for(let i = 0; i < n; i++) b = keyFromB64(s)
  t0 = Date.now()
  console.log('keyFromB64', t0 - t1)

  /*
  for(let i = 0; i < n; i++) s = bytesToBase64(bin1)
  t1 = Date.now()
  console.log(t1 - t0)
  for(let i = 0; i < n; i++) b = base64ToBytes(s)
  t0 = Date.now()
  console.log(t0 - t1)
  */
}

function t2 () {
  let u
  s = keyToB64(bin1.buffer)
  let t0 = Date.now()
  for(let i = 0; i < n; i++) u = toUrl1(s)
  let t1 = Date.now()
  console.log('toUrl1', t1 - t0)
  for(let i = 0; i < n; i++) u = toUrl2(s)
  t0 = Date.now()
  console.log('toUrl2', t0- t1)
  for(let i = 0; i < n; i++) u = fromUrl(s)
  t1 = Date.now()
  console.log('fromUrl', t1 - t0)
  for(let i = 0; i < n; i++) u = fromUrl2(s)
  t0 = Date.now()
  console.log('fromUrl2', t0 - t1)
  /* cata
  for(let i = 0; i < n; i++) s = fromUrl1(s)
  t1 = Date.now()
  console.log('fromUrl1', t1 - t0)
  */
}

t1() // -> keyToB64 / keyFromB64
t2() // -> toUrl2