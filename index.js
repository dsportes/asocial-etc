const crypt = require('./crypto')

const options = { fileMustExist: true, verbose: console.log }
const db = require('better-sqlite3')('./test.db3', options)

const inscompte = db.prepare('INSERT INTO compte (id, dhc, datax) VALUES (@id, @dhc, @datax)')
const selcompte = db.prepare('SELECT * FROM compte')


function crcompteavatar (rows) {
    rows.forEach(row => inscompte.run(row))
}

const rows = [
    { id:BigInt('99999999999999999'), dhc:20210518114125, datax:crypt.random(60) }
]
db.transaction(crcompteavatar)(rows)

selcompte.safeIntegers(true)
const res = selcompte.all()
res.forEach(r => {
    const dhc = Number(r.dhc)
    console.log(typeof r.id + ' ' + typeof r.dhc + ' ' + typeof r.datax + ' ' + typeof dhc)
})

// db.transaction(crcompteavatar)(rows)
// select()
// crypt.test()
// crypt.test2()
