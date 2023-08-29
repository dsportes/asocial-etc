const crypt = require('./crypto')

function sleep(delai) { return new Promise(resolve => { setTimeout(() => { resolve() }, delai) }) }

const options = { fileMustExist: false /*, verbose: console.log */ }
const db = require('better-sqlite3')('D:/temp/testbk.db3', options)

const instest1 = db.prepare('INSERT INTO test1 (id, k2, data) VALUES (@id, @k2, @data)')
const majv = db.prepare('UPDATE versions SET v = @v WHERE id = @id')
const selv = db.prepare('SELECT v FROM versions WHERE id = 1')

let version = 1

function tr1 (rows) {
    rows.forEach(row => 
      instest1.run(row)
    )
    majv.run( { id:1, v:version } )
}

const rows = [ ]

function genrows (s, nb) {
  rows.length = 0
  for (let i = 1; i <= nb; i++) {
    rows.push( { id: s + i, k2: crypt.intToU8(999 * i), data:crypt.random(200)})
    version++
  }
}

async function loaddb (x) {
  for (let s = x; s <= x + 50; s++) {
    genrows(s * 1000, 100)
    db.transaction(tr1)(rows)
    console.log('insert ' + s)
    await sleep(1000)
  }
}

function bk () {
  const t1 = new Date().getTime()
  let paused = false
  db.backup(`D:/temp/backup-${Date.now()}.db3`, {
      progress({ totalPages: t, remainingPages: r }) {
        console.log(`progress: ${((t - r) / t * 100).toFixed(1)}%`);
        return paused ? 0 : 200;
      }
    }
  )
  .then(() => {
    const t2 = new Date().getTime()
    console.log('backup complete! ' + (t2 - t1) + 'ms');
    const ver1 = selv.get()
    console.log('version 1 : ' + ver1.v)
  })
  .catch((err) => {
    console.log('backup failed:', err);
  });
}

// loaddb(301)
bk()
