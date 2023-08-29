const interdits = /[<>:"/\\|?*\x00-\x1F]/g
const s1 = 'fic<a>b:c"d/e\\f|g?h*.ext'
const ns1 = s1.replace(interdits, '_')
console.log(ns1)

const interdits2 = /[\u{0180}-\u{10FFFF}]/gu
const s2 = 'GöödnightƢbla👍(par Thomas)'
const ns2 = s2.replace(interdits2, '')
console.log(ns2)
