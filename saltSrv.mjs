import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const crypt = require('./crypto.js')
import { fromByteArray } from './base64.mjs'

const buf = Buffer.from(crypt.random(32))
const b64 = fromByteArray(buf)
console.log(b64)
