const options = { fileMustExist: false, verbose: console.log }
const db = require('better-sqlite3')('./test.db3', options)

db.function('ts', (id) => id.length === 9 ? 1 : (id.length === 8 ? 2 :3))
db.function('gr', (id) => id.length !== 9 ? 0 : crypt.u8ToInt(id.slice(0, 5)))
db.function('av1', (id) => id.length !== 8 && id.length !== 13 ? 0 : crypt.u8ToInt(id.slice(0, 5)))
db.function('av2', (id) => id.length !== 13 ? 0 : crypt.u8ToInt(id.slice(5, 10)))

const createSecret = db.prepare('CREATE TABLE IF NOT EXISTS "secret" ("id"	BLOB, "dhc"	INTEGER, "data"	TEXT, PRIMARY KEY("id")) WITHOUT ROWID')
const createIndex = db.prepare('CREATE INDEX secret_gr_dhc ON secret (gr(id), dhc)')
createSecret.run()
createIndex.run()