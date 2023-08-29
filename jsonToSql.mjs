import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const fs = require('fs')

import { encode, decode } from '@msgpack/msgpack'

const data = require('./dbload.json')

const res = []

data.forEach(item => {
  const l = ['insert into ' + item.nom + ' (']
  const cols = []
  const vals = []
  for (const key in item) {
    if (key === 'nom') continue
    const val = item[key]
    cols.push(key)
    if (key === '_data_') {
      const b = Buffer.from(encode(val))
      const hx = b.toString('hex')
      const b2 = Buffer.from(hx, 'hex')
      const obj = decode(b2)
      vals.push('x\'' + hx + '\'' )
    } else {
      if (typeof val === 'string') vals.push('\'' + val + '\''); else vals.push(val)
    }
  }
  const x = cols.join(', ')
  l.push(x)
  l.push(') values (')
  l.push(vals.join(', '))
  l.push(');')
  const t = l.join('')
  res.push(t)
  console.log(t)
})

const texte = res.join('\n')
fs.writeFileSync('./dbload.sql', texte)
