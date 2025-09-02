function log10(v) {
  const x = Math.log10(v)
  return Math.round(x * 20)
}

function pow10(v) {
  const x = Math.pow(10, v / 20)
  return Math.round(x)
}

const t = [1, 100, 1000, 4000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000, 500000000]
for (let i = 0; i < t.length; i++) {
  const x = t[i]
  const y = log10(x)
  const z = pow10(y)
  console.log(x + ' ' + y + ' ' + z)
}
// test new token
 