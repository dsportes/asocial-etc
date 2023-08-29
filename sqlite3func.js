const options = { fileMustExist: true, verbose: console.log }
const db = require('better-sqlite3')('./test.db3', options)

const ins1 = db.prepare('INSERT INTO avatar (id, dh) VALUES (@id, @dh)')
const sel1 = db.prepare('SELECT * FROM avatar WHERE id = @id')
const begin = db.prepare('BEGIN')
const commit = db.prepare('COMMIT')
const rollback = db.prepare('ROLLBACK')

async function insertion (id) {
    ins1.run({ id: id, dh: new Date().toUTCString() })
}

async function select (id) {
    const rows = sel1.all({ id: id })
    return rows
}

async function main (n) {
    try {
        begin.run()
        await insertion(n)
        await insertion(n+1)
        if (n === 3) throw 'bug'
        await insertion(n+2)
        const rows = await select (n+2)
        rows.forEach(r => { console.log(r.dh) })
        commit.run()
    } catch (e) {
        rollback.run()
    }
}

main(2)
// main(2)
