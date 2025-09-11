/*
**Commandes usuelles:**
  # depuis ./emulators

  # Lancement avec mémoire vide:
  firebase emulators:start --project asocial2

  # Lancement avec chargée depuis un import:
  firebase emulators:start --import=./bk/t1

  # Le terminal reste ouvert. Arrêt par CTRL-C (la mémoire est perdue)

En cours d'exécution, on peut faire un export depuis un autre terminal:

  firebase emulators:export ./bk/t2 -f

**Consoles Web sur les données:**

  http://127.0.0.1:4000/firestore
  http://127.0.0.1:4000/storage

  "testsrv": "npx tsx firestore2.ts",
*/

import { env } from 'process'
import { CollectionReference, DocumentReference, Firestore, Query, QuerySnapshot, Transaction } from '@google-cloud/firestore'
import crypto from 'crypto'
// import { encode, decode } from '@msgpack/msgpack'

env['GOOGLE_CLOUD_PROJECT'] = 'asocial2'
env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8085'
env['STORAGE_EMULATOR_HOST'] = 'http://127.0.0.1:9199'
env['GOOGLE_APPLICATION_CREDENTIALS'] = './config/asocial2-service_account.json'

const encoder = new TextEncoder()

function sha32 (x: any) : string {
  return crypto.createHash('sha256').update(encoder.encode(x)).digest().toString('base64url')
}

function sha12 (x: any) : string {
  return crypto.createHash('sha256').update(encoder.encode(x)).digest().subarray(3, 15).toString('base64url')
}

const fs = new Firestore()

enum updType { CREATE, UPDATE, SET, DELETE }

type update = {
  type: updType,
  dr: DocumentReference,
  row: row
}

class Operation {
  transaction: Transaction | null
  updates: update[]

  constructor (tr?: Transaction) {
    this.transaction = tr || null
    this.updates = []
  }

  setUpd (type: updType, dr: DocumentReference, row: row) {
    this.updates.push({type, dr, row})
  }

  async commit () {
    for (const u of this.updates) {
      switch (u.type) {
        case updType.CREATE : { 
          if (this.transaction) this.transaction.create(u.dr, u.row); else await u.dr.create(u.row)
          break
        }
        case updType.UPDATE : { 
          if (this.transaction) this.transaction.update(u.dr, u.row); else await u.dr.update(u.row)
          break
        }
        case updType.SET : { 
          if (this.transaction) this.transaction.set(u.dr, u.row); else await u.dr.set(u.row)
          break
        }
      }
    }
  }
}

let op : Operation = new Operation()

let colRef: CollectionReference

let time = Date.UTC(2025, 8, 11, 10, 0, 0, 0)
const time0 = time
let day = Math.floor(time/ 86400000)
const day0 = day
let t = 0

function clockPlus(ms: number) {
  time += ms
  Math.floor(time/ 86400000)
}

// eslint-disable-next-line no-unused-vars
async function main1 () {
  try {
    const dr = fs.doc('singletons/ping')
    await dr.set({ dh: new Date().toISOString() })
  } catch (e) {
    console.log(e)
  }
}

async function main2 () {
  try {
    const c1 = fs.collection('ORGS/demo/AVATARS')
    const pk = 'daniel.sportes'
    const idh = sha12(pk)

    const dr = c1.doc(sha12(pk))
    await dr.set({ idh: idh, pk: pk, nom: 'Sportes', v: 2 })

    const q = c1.where('idh', '==', idh).where('v', '>', 1)
    const qs = await q.get()
    if (!qs.empty) {
      const ds = qs.docs[0]
      const row = ds.data()
      console.log(row.nom, row.pk)
    } else {
      console.log('néant')
    }
  } catch (e) {
    console.log(e)
  }
}

type row = {
  pk?: string,
  ck?: string,
  v?: number,
  z?: number,
  data?: string
}

interface rowArticle extends row {
  auteurs: string[],
  sujet: string
}

async function loadRowArticle (row: rowArticle) {
  const dr = fs.doc('Org/demo/Article/' + (row.ck || row.pk))
  op.setUpd(updType.CREATE, dr, row)
}

async function updateArticle ([newRow, pk, ckn], oldRow?: row | null) {
  const vn = newRow['v']
  newRow['pk'] = pk

  if (oldRow) {
    const cko = getCk(oldRow)
    if (ckn !== cko) {
      // création / maj de l'article -
      const row = await getArticleCk(cko)
      const dr = fs.doc('Org/demo/Article/' + cko)
      if (row) { // maj de l'article - ; version et zombi repoussées
        const r = { v: vn, z: day}
        op.setUpd(updType.UPDATE, dr, r)
      } else { // création de l'article -
        const r = dataIdxToArt(JSON.parse(oldRow.data || ''))
        r.ck = cko
        r.v = vn 
        r.z = day
        r.data = JSON.stringify({ pk: pk, removed: r.v })
        op.setUpd(updType.CREATE, dr, r)
      }
    }
  }
  // set du nouveau row: soit il n'existait pas, soit il était zombi
  const dr = fs.doc('Org/demo/Article/' + pk)
  op.setUpd(updType.SET, dr, newRow)
}

/* Retourne tous les rows articles existants réellement.
Ayant une pk et n'étant pas zombi
*/
async function tousArticles (v?: number) : Promise<Object[]>{
  const rows: Object[] = []
  let q: Query
  if (!v) {
    q = colRef.where('pk', '!=', false).where('z', '==', 0)
  } else {
    q = colRef.where('pk', '!=', false).where('v', '>', v).where('z', '==', 0)
  }
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (!qs.empty) for (let doc of qs.docs) rows.push(doc.data())
  return rows
}

async function getCollLst(prop: string, val: string, v?: number) : Promise<Object[]> {
  const rows: Object[] = []
  let q: Query
  if (!v) {
    q = colRef.where(prop, 'array-contains', val).where('pk', '!=', false).where('z', '==', 0)
  } else {
    q = colRef.where(prop, 'array-contains', val).where('v', '>', v)
  }
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (!qs.empty) for (let doc of qs.docs) rows.push(doc.data())
  return rows
}

/* Retourne l'article de pk fixée existant ou zombi réellement.
*/
async function getArticlePk (pk: string, v?: number) : Promise<row | null> {
  const q = colRef.where('pk', '==', pk).where('v', '>', v)
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  return qs.empty ? null : (qs.docs[0].data() as row)
}

/* Retourne l'article de pk fixée existant ou zombi réellement.
*/
async function getArticleCk (ck: string) : Promise<row | null> {
  const q = colRef.where('ck', '==', ck)
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  return qs.empty ? null : (qs.docs[0].data() as row)
}

/* Retourne tous les rows articles existants ou zombi
Ayant une pk.
*/
async function exportArticles () {
  const rows: Object[] = []
  const q = colRef.where('pk', '!=', false)
  const qs: QuerySnapshot = await q.get()
  if (!qs.empty) for (let doc of qs.docs) rows.push(doc.data())
  return rows
}

function getCk (row: row) { 
  return '$' + sha12(row.pk + ';' + row['auteurs'].join('/') + ';' + row['sujet'] )
}

function getPk (data: Object) { return sha12(data['id']) }

function dataToArt (data: Object) : [row, string, string] {
  const a = dataIdxToArt(data) as row
  a.v = data['v']
  a.z = 0
  a.data = JSON.stringify(data)
  return [a, getPk(data), getCk(a)]
}

function dataIdxToArt (data: Object) : rowArticle {
  return { auteurs: data['auteurs'], sujet: data['sujet'] }
}

function dataToArtPk (data: Object) : rowArticle {
  const [a, pk, ] = dataToArt(data)
  a.pk = pk
  return a as rowArticle
}

async function main3 () : Promise<string> {
  try {
    for(let i = 0; i < 10; i++)
      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        await loadRowArticle(dataToArtPk({ id: 'a5' + i, auteurs: ['h', 'v'], sujet: 'S1', v: time + 100 + i, texte: 'blabla' }))
        await loadRowArticle(dataToArtPk({ id: 'a6' + i, auteurs: ['h'], sujet: 'S1', v: time + 100 + i, texte: 'blublu' }))
        await op.commit()
      })

    let rows: Object[]
    let row: Object | null

    op = new Operation()

    console.log('\nexportArticles --------------------- ')
    rows = await exportArticles()
    rows.forEach(r => console.log(JSON.stringify(r)))

    console.log('\ntousArticles --------------------- ')
    rows = await tousArticles()
    rows.forEach(r => console.log(JSON.stringify(r)))

    t = 100
    console.log('\nexportArticles --------------------- ', t)
    rows = await tousArticles(time0 + t)
    rows.forEach(r => console.log(JSON.stringify(r)))

    t = 50
    console.log('\ngetArticle a5 --------------------- ', t)
    let a5 = await getArticlePk(sha12('a52'), time0 + t)
    console.log(a5 ? JSON.stringify(a5) : 'NOT FOUND')

    t = 100
    console.log('\ngetArticle a5 -------------------- ', t)
    row = await getArticlePk(sha12('a52'), time0 + t)
    console.log(row ? JSON.stringify(row) : 'NOT FOUND')

    t = 0
    console.log('\ngetColl h --------------------- ', t)
    rows = await getCollLst('auteurs', 'h', 0)
    rows.forEach(r => console.log(JSON.stringify(r)))

    t = 100
    console.log('\ngetColl h --------------------- ', t)
    rows = await getCollLst('auteurs', 'h', time0 + t)
    rows.forEach(r => console.log(JSON.stringify(r)))

    clockPlus(1000)
    if (a5) {
      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        const dataA5 = a5 ? JSON.parse(a5.data || '') : {}
        dataA5['texte'] = 'blibli'
        dataA5['v'] = time + 100
        dataA5['auteurs'] = ['v', 'z']
        await updateArticle(dataToArt(dataA5), a5)
        op.commit()
      })
      
      op = new Operation()
      
      t = 99
      console.log('\ngetArticle a5 --------------------- ', t)
      a5 = await getArticlePk(sha12('a52'), time0 + 99)
      console.log(row ? JSON.stringify(row) : 'NOT FOUND')
      
    }
    /*
    t = 0
    console.log('\ntousArticles --------------------- ', t)
    rows = await tousArticles()
    rows.forEach(r => console.log(JSON.stringify(r)))
    */
    t = 99
    console.log('\ngetColl h --------------------- ', t)
    rows = await getCollLst('auteurs', 'h', time0 + 99)
    rows.forEach(r => console.log(JSON.stringify(r)))

    if (a5) await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        const dataA5 = JSON.parse(a5.data || '')
        dataA5['texte'] = 'blibli'
        dataA5['v'] = time + 110
        dataA5['auteurs'] = ['h', 'v', 'z']
        await updateArticle(dataToArt(dataA5), a5)
        op.commit()
      })

    op = new Operation()
    t = 99
    console.log('\ngetColl h --------------------- ', t)
    rows = await getCollLst('auteurs', 'h', time0 + 99)
    rows.forEach(r => console.log(JSON.stringify(r)))

    return 'OK'
  } catch (e) {
    console.log(e)
    return 'KO'
  }
}

setTimeout(async () => {
  colRef = fs.collection('Org/demo/Article')
  const res = await main3()
  console.log(res)
}, 10)
