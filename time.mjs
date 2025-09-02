const t0 = Date.UTC(2000, 0, 1, 0, 0, 0)
console.log('2000', t0)
// let x = Date.now()
const x = Date.UTC(2099, 11, 31, 23, 59, 59, 999)
const ms = x % 86400000
const nj = Math.floor(x / 86400000)
console.log('2099', x, nj, ms)
const y = (nj * 100000000) + ms
console.log(y, (''+y).length)
const n = Number.MAX_SAFE_INTEGER
console.log (n, (''+n).length)