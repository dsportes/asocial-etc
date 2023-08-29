const fs = require('fs')
const crypt = require('./crypto')

function genSalts () {
  const s = []
  for (let i = 0; i < 256; i++) s.push(Buffer.from(crypt.random(16)))
  fs.writeFileSync('./salts', Buffer.concat(s))
}

// genSalts()

crypt.setSalts (fs.readFileSync('./salts'))

crypt.test()
