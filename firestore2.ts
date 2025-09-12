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
  row: row | rowRC
}

class Operation {
  transaction: Transaction | null
  updates: update[]

  constructor (tr?: Transaction) {
    this.transaction = tr || null
    this.updates = []
  }

  setUpd (type: updType, dr: DocumentReference, row: row | rowRC) {
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

let time = Date.UTC(2025, 8, 11, 10, 0, 0, 0)
const time0 = time
let day = Math.floor(time/ 86400000)
const day0 = day
let t = 0

const org = 'demo'
const clazz = 'Article'

function clockPlus(ms: number) {
  time += ms
  Math.floor(time/ 86400000)
}

type row = {
  pk: string,
  v: number,
  ttl?: number
}
interface rowD extends row {
  data: string
}
interface rowQ extends row {
  col: string
}

function docRef (org: string, clazz: string, pk: string) {
  return fs.doc('Org/'+ org + '/' + clazz + '/' + pk)
}

function docRefQ (org: string, clazz: string, col: string, pk: string, val: string) {
  return fs.doc('Org/'+ org + '/' + clazz + '@' + col + '/' + pk + '@' + val)
}

function colRef (org: string, clazz: string) {
  return fs.collection('Org/'+ org + '/' + clazz)
}

function colRefQ (org: string, clazz: string, colName: string) {
  return fs.collection('Org/'+ org + '/' + clazz + '@' + colName)
}

/* Import (insert / create) un row:
- clazz: classe du document - 'Article'
- org: code l'organisation - 'demo'
- row: row
*/
async function importRow (ut: updType, org: string, clazz: string, row: row) {
  op.setUpd(ut, docRef(org, clazz, row.pk), row)
}

/* Inscrit le rowQ déclarant que le document clazz/pk ne fait plus
partie de la collection clazz/col à partir de v.
- clazz: classe du document - 'Article'
- org: code l'organisation - 'demo'
- colName: nom de la propriété de sous-collection 
- row: row - contient pk et col
*/
async function importRowQ (org: string, clazz: string, colName: string, row: rowQ) {
  op.setUpd(updType.SET, docRefQ(org, clazz, colName, row.pk, row.col), row)
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

/* Retourne tous les rows de la classe indiquée:
- si v absent: tous ceux existant réellement à l'instant t.
- si v : présent: ceux mis à jour ou supprimés postérieueremt à v.
Ceux
*/
async function allRows (org: string, clazz: string, v?: number) : Promise<Object[]>{
  const rows: Object[] = []
  const cr = colRef(org, clazz)
  const q: Query = !v ? cr : cr.where('v', '>', v)
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (!qs.empty) for (let doc of qs.docs) {
    const row = doc.data() as rowD
    if ((!v && !row.ttl) || v) rows.push(row)
  }
  return rows
}

/* Retourne le row de classe fixée ayant la pk fixée:
- si v absent: ne retourne pas le row s'il est supprimé
- si v présent ne retourne le row QUE s'il a été mis à jour ou supprimé après v.
  si supprimé, le data l'indique.
*/
async function oneRow (org: string, clazz: string, pk: string, v?: number) : Promise<rowD | null> {
  const cr = colRef(org, clazz)
  const q: Query = !v ? cr : cr.where('v', '>', v)
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (qs.empty) return null
  const row = qs.docs[0].data() as rowD
  return (!v && row.ttl) ? null : row
}

type pkv = [ pk: string, v: number ]

/* Pour la classe 'clazz' (par exemple 'Article'), l'obtention d'une sous-collection
(par exemple ceux ayant 'Zola' dans sa liste des 'auteurs') - [Article/auteurs/Zola]
comporte deux listes:
- une liste D des documents de la classe,
  - soit faisant partie ACTUELLEMENT de la sous-collection.
  - soit ayant été supprimés après v.
  et ayant été modifié postérieurement après v.
- une liste Q des couples (pk, v) des documents de clé pk ayant quitté la sous-collection 
  postérieurement à v.
Il se peut que dans Q soient cités des documents ayant quitté la collection
à t2 alors qu'ils inscrits comme présents à t3 dans D. Ils sont à ignorer.

Si v est absent:
- D est la liste INTEGRALE des docuements de la collection à l'instant t.
- Q est vide.

isList: true si la propriété est une liste.
*/
async function getColl(org: string, clazz: string, colName: string, col: string, isList: boolean, v?: number) : Promise<Object[]> {
  const rows: Object[] = []
  const lpkv: pkv[] = []
  const crd = colRef(org, clazz)
  const crq = colRefQ(org, clazz, colName)
  const comp = isList ? 'array-contains' : '=='

  let q: Query
  if (!v) {
    q = crd.where(colName, comp, col)
  } else {
    q = crd.where(colName, comp, col).where('v', '>', v)
  }
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (!qs.empty) for (let doc of qs.docs) {
    const row = doc.data() as rowD
    if ((!v && !row.ttl) || v) rows.push(row)
  }

  if (v) {
    q = crq.where('col', '==', col).where('v', '>', v)
    const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
    if (!qs.empty) for (let doc of qs.docs) {
      const row = doc.data() as rowQ
      lpkv.push([row.pk, row.v])
    }
  }

  return [rows, lpkv]
}

function getPk (data: Object, props: string[]) {
  if (props.length === 1) return sha12(data[props[0]])
  const t : string[] = []
  props.forEach(p => { t.push(data[p])})
  return sha12(t.join('/')) 
}

class Rb {
  row: rowD
  data: Object
  constructor (data: Object, props: string[]) {
    this.data = data
    this.row =  {
      pk: getPk(data, props),
      v: data['v'],
      data: JSON.stringify(data)
    }
  }
  addIdx (name: string) {
    this.row[name] = this.data[name]
    return this
  }
}

async function importArt (data: Object) {
  await importRow (updType.CREATE, org, clazz, new Rb(data, ['id']).addIdx('auteurs').addIdx('sujet').row)
}

function titre (l: string) {
  console.log('\n time:' + (time - time0) + '   v:' + t + ' ---------------- ' + l)
}

async function main3 () : Promise<string> {
  try {
    for(let i = 0; i < 4; i++)
      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        await importArt({ id: 'a5' + i, auteurs: ['h', 'v'], sujet: 'S1', v: time + 100 + i, texte: 'blabla' })
        await importArt({ id: 'a6' + i, auteurs: ['h'], sujet: 'S1', v: time + 100 + i, texte: 'blublu' })
        await op.commit()
      })

    let rows: Object[]
    let row: Object | null
    let a52: rowD | null

    op = new Operation()

    titre('allRows')
    rows = await allRows(org, clazz)
    rows.forEach(r => console.log(JSON.stringify(r)))

    t = 102 // après les deux premiers articles
    titre('allRows')
    rows = await allRows(org, clazz, time + t)
    rows.forEach(r => console.log(JSON.stringify(r)))

    t = 0
    titre('Article a52')
    a52 = await oneRow(org, clazz, sha12('a52'))
    console.log(a52 ? JSON.stringify(a52) : 'NOT FOUND')
    
    t = 50
    titre('Article a52')
    a52 = await oneRow(org, clazz, sha12('a52'), time + t)
    console.log(a52 ? JSON.stringify(a52) : 'NOT FOUND')

    t = 110
    titre('Article a52')
    a52 = await oneRow(org, clazz, sha12('a52'), time + t)
    console.log(a52 ? JSON.stringify(a52) : 'NOT FOUND')

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
