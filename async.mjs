async function f1 (n) {
  if (n % 2 === 0) return ('NOWAIT: ' + n)
  return new Promise(resolve => {
    setTimeout(() => {
      resolve('TO: ' + n)
    }, n*1000)
  })
}

async function main (n) {
  const p = f1(n) // OU const p = f1(n)
  if (typeof p === 'string') {
    console.log(p)
  } else {
    const s = await p
    console.log(s)
  }
}

main (2)
