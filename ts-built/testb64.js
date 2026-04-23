import { toByteArray, fromByteArray } from './base64';
function ab2str(buf) {
    // @ts-expect-error
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}
function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++)
        bufView[i] = str.charCodeAt(i);
    return buf;
}
function keyToB64(key) {
    return window.btoa(ab2str(key));
}
function keyFromB64(key) {
    return str2ab(window.atob(key));
}
function random(nbytes) {
    const u8 = new Uint8Array(nbytes);
    window.crypto.getRandomValues(u8);
    return u8;
}
function toUrl1(s) {
    return s.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function toUrl2(s) {
    let i = s.length;
    for (; s.charAt(i) === '='; i--)
        s.substring(0, i).replace(/\+/g, '-').replace(/\//g, '_');
}
function fromUrl(s) {
    return s.replace(/-/g, '+').replace(/_/g, '/') + '===='.substring(0, 4 - s.length % 4);
}
function u8ToB64(u8) { return fromByteArray(u8); }
function b64ToU8(s) { return toByteArray(s); }
const bin1 = random(300);
let n = 10;
let s;
let t0 = Date.now();
for (let i = 0; i < n; i++)
    s = u8ToB64(bin1);
let t1 = Date.now();
console.log(t1 - t0);
// @ts-expect-error
for (let i = 0; i < n; i++)
    s = keyToB64(bin1.buffer);
t0 = Date.now();
console.log(t0 - t1);
