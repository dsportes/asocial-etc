let x = Date.UTC(2025, 0, 1, 0, 0, 0, 0)
let ms = x % 86400000
let nj = Math.floor(x / 86400000)
let y = (nj * 100000000) + ms
console.log('2025', y, nj, ms, (''+y).length)

x = Date.UTC(2099, 11, 31, 23, 59, 59, 999)
ms = x % 86400000
nj = Math.floor(x / 86400000)
y = (nj * 100000000) + ms
console.log('2099', y, nj, ms, (''+y).length)

const n = Number.MAX_SAFE_INTEGER
console.log (n, (''+n).length)