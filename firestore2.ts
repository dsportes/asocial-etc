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
import { CollectionReference, DocumentReference, Firestore, Query, QuerySnapshot, Timestamp, Transaction } from '@google-cloud/firestore'
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
  row: rowD | rowQ
}

class Operation {
  transaction: Transaction | null
  updates: update[]

  constructor (tr?: Transaction) {
    this.transaction = tr || null
    this.updates = []
  }

  setUpd (type: updType, dr: DocumentReference, row: rowD | rowQ) {
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
          if (this.transaction) this.transaction.update(u.dr, {...u.row}); else await u.dr.update({...u.row})
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
let t = 0

const org = 'demo'
const clazz = 'Article'
const zombiLapse = 90 * 86400 // 90 jours en secondes

function clockPlus(ms: number) {
  time += ms
  Math.floor(time/ 86400000)
}

type row = {
  pk: string,
  v: number,
  ttl?: Timestamp
}

interface rowD extends row {
  del?: number, // SI existe (!undefined), epoch en MINUTES de suppression DANS LE PASSE
  data: string
}
interface rowQ extends row {
  col: string
}

function docRef (org: string, clazz: string, pk: string) {
  return fs.doc((org ? 'Org/'+ org + '/' : '') + clazz + '/' + pk)
}

function docRefQ (org: string, clazz: string, col: string, pk: string, val: string) {
  return fs.doc('Org/'+ org + '/' + clazz + '@' + col + '/' + pk + '@' + val)
}

function colRef (org: string, clazz: string) {
  return fs.collection((org ? 'Org/'+ org + '/' : '') + clazz)
}

function colRefQ (org: string, clazz: string, colName: string) {
  return fs.collection('Org/'+ org + '/' + clazz + '@' + colName)
}

/* Import (insert / create) un row:
- clazz: classe du document - 'Article'
- org: code l'organisation - 'demo'
- row: row
*/
async function importRow (ut: updType, org: string, clazz: string, row: rowD | rowQ) {
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
  const secs = Math.floor(row.v / 1000)
  row.ttl = new Timestamp(Math.floor(row.v / 1000) + zombiLapse, 0)
  op.setUpd(updType.SET, docRefQ(org, clazz, colName, row.pk, row.col), row)
}

function normTTL (row: rowD, appttl: boolean | undefined) : rowD {
  if (row.ttl) {
    const sec = row.ttl.seconds
    if ((appttl && ((sec * 1000) < time)) || !appttl) row.del = Math.floor(sec / 60)
    delete row.ttl
  }
  return row
}

/* Retourne tous les rows de la classe indiquée:
- si v = 0: tous ceux existant réellement à l'instant t.
- sinon: ceux mis à jour ou supprimés postérieueremt à v.
SI appttl, l'application gère le TTL. Un document N'EXISTE PLUS si sa ttl est DEPASSEE.
Cas standard (appttl absent ou false). Un document N'EXISTE PLUS
DES QU'IL A UNE TTL (dépassée ou non).
Ceux
*/
async function allRows (org: string, clazz: string, 
  v: number, appttl?: boolean) : Promise<Object[]>{
  
  const rows: Object[] = []
  const cr = colRef(org, clazz)
  const q: Query = !v ? cr : cr.where('v', '>', v)
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (!qs.empty) for (let doc of qs.docs) {
    const row = normTTL(doc.data() as rowD, appttl)
    if ((!v && !row.del) || v) rows.push(row)
  }
  return rows
}

/* Retourne le row de classe fixée ayant la pk fixée:
- si v absent: ne retourne pas le row s'il est supprimé
- si v présent ne retourne le row QUE s'il a été mis à jour ou supprimé après v.
  si supprimé, le data l'indique.
*/
async function oneRow (org: string, clazz: string, 
  pk: string, v: number, appttl?: boolean) : Promise<rowD | null> {
  
  const cr = colRef(org, clazz)
  const q: Query = !v ? cr.where('pk', '==', pk) : cr.where('pk', '==', pk).where('v', '>', v)
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (qs.empty) return null
  const row = normTTL(qs.docs[0].data() as rowD, appttl)
  return (!v && row.del) ? null : row
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
async function getColl(org: string, clazz: string, 
  colName: string, col: string, isList: boolean, v: number, appttl?: boolean) : Promise<[rowD[], pkv[]]> {
  
  const rows: rowD[] = []
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
    const x = doc.data() as rowD
    const row = normTTL(x, appttl)
    if ((!v && !row.del) || v) rows.push(row)
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
  constructor (data: Object, props: string[], zombi?: boolean) {
    this.data = data
    const v = data['v']
    this.row = { pk: getPk(data, props), v, data: JSON.stringify(data) }
    const ttl = data['ttl'] // epoch en minutes (sur un entier) de FIN DE VIE
    if (ttl) this.row.ttl = new Timestamp(ttl * 60, 0)
    if (zombi) this.row.ttl = new Timestamp(Math.floor(v / 1000), 0)
  }
  addIdx (name: string) {
    this.row[name] = this.data[name]
    return this
  }
}

async function importArt (data: Object) {
  await importRow (updType.CREATE, org, clazz, new Rb(data, ['id']).addIdx('auteurs').addIdx('sujet').row)
}

async function updateArt (data: Object) {
  await importRow (updType.UPDATE, org, clazz, new Rb(data, ['id']).addIdx('auteurs').addIdx('sujet').row)
}

async function zombiArt (data: Object) {
  await importRow (updType.UPDATE, org, clazz, new Rb(data, ['id'], true).row)
}

async function importHdr (v: number, label: string, status: number) {
  await importRow (updType.CREATE, '', 'ROOT', { pk: 'hdr', v: v, data: JSON.stringify({ v, label, status})})
}

function trap (e: any) : [number, string] { // 1: busy, 2: autre
  if (e.constructor.name !== 'FirestoreError') throw e
  const s = (e.code || '???') + ' - ' + (e.message || '?')
  if (e.code && e.code === 'ABORTED') return [1, s]
  return [2, s]
}

async function ping () : Promise<[number, string]> {
  try {
    let t = '?'
    const dr = docRef('', 'ROOT', 'ping')
    const ds = await dr.get()
    if (ds.exists) t = ds.get('data')
    const v = time
    const data = new Date(v).toISOString()
    await dr.set({ v, data })
    return [0, 'Firestore ping OK: ' + (t || '?') + ' <=> ' + data]
  } catch (e) {
    return trap(e)
  }
}

function titre (l: string) {
  console.log('\n time:' + (time - time0) + '   v:' + t + ' ---------------- ' + l)
}

async function main3 () : Promise<string> {
  try {
    console.log('PING: ' + (await ping())[1])

    clockPlus(10)
    console.log('PING: ' + (await ping())[1])

    await fs.runTransaction(async (tr) => { 
      op = new Operation(tr)
      await importHdr(time, 'serveur toto', 1)
      await op.commit()
    })

    for(let i = 0; i < 4; i++)
      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        await importArt({ id: 'a5' + i, auteurs: ['h', 'v'], sujet: 'S1', v: time + 100 + i, texte: 'blabla' })
        await importArt({ id: 'a6' + i, auteurs: ['h'], sujet: 'S1', v: time + 100 + i, texte: 'blublu' })
        await importArt({ id: 'a7' + i, auteurs: ['z'], sujet: 'S1', v: time + 100 + i, texte: 'blublu' })
        await op.commit()
      })

    op = new Operation()

    let rows: Object[]
    let row: rowD | null
    let a52: rowD | null

    titre('allRows')
    rows = await allRows(org, clazz, 0)
    rows.forEach(r => console.log(JSON.stringify(r)))

    t = 102 // après les deux premiers articles
    titre('allRows')
    rows = await allRows(org, clazz, time + t)
    rows.forEach(r => console.log(JSON.stringify(r)))

    t = 0
    titre('Article a52')
    row = await oneRow(org, clazz, sha12('a52'), 0)
    console.log(row ? JSON.stringify(row) : 'NOT FOUND')
    a52 = row
    
    t = 50
    titre('Article a52')
    row = await oneRow(org, clazz, sha12('a52'), time + t)
    console.log(row ? JSON.stringify(row) : 'NOT FOUND')

    t = 110
    titre('Article a52')
    row = await oneRow(org, clazz, sha12('a52'), time + t)
    console.log(row ? JSON.stringify(row) : 'NOT FOUND')

    {
      titre('collection auteurs h')
      const [rows, lpkv] = await getColl(org, clazz, 'auteurs', 'h', true, 0, false)
      rows.forEach(r => console.log(JSON.stringify(r)))
      console.log(JSON.stringify(lpkv))
    }

    clockPlus(1000)
    if (a52) {
      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        const data = JSON.parse(a52.data)
        data['texte'] = 'blibli'
        data['v'] = time + 100
        data['auteurs'] = ['v', 'z']
        await updateArt(data)
        const rowQ : rowQ = { pk: a52.pk, col: 'h', v: time }
        await importRowQ (org, clazz, 'auteurs', rowQ)
        op.commit()
      })

      op = new Operation()
      titre('Article a52')
      row = await oneRow(org, clazz, sha12('a52'), 0)
      console.log(row ? JSON.stringify(row) : 'NOT FOUND')

      {
        titre('collection auteurs h')
        const [rows, lpkv] = await getColl(org, clazz, 'auteurs', 'h', true, time - 1, false)
        rows.forEach(r => console.log(JSON.stringify(r)))
        console.log(JSON.stringify(lpkv))
      }

      {
        titre('collection auteurs h')
        const [rows, lpkv] = await getColl(org, clazz, 'auteurs', 'h', true, 0, false)
        rows.forEach(r => console.log(JSON.stringify(r)))
        console.log(JSON.stringify(lpkv))
      }
      
      {
        titre('collection auteurs z')
        const [rows, lpkv] = await getColl(org, clazz, 'auteurs', 'z', true, 0, false)
        rows.forEach(r => console.log(JSON.stringify(r)))
        console.log(JSON.stringify(lpkv))
      }
    }

    clockPlus(1000)
    if (a52) {
      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        const data = { id: 'a52', v: time }
        await zombiArt(data)
        await importRowQ (org, clazz, 'auteurs', { pk: a52.pk, col: 'v', v: time })
        await importRowQ (org, clazz, 'auteurs', { pk: a52.pk, col: 'z', v: time })
        op.commit()
      })

      op = new Operation()
      titre('Article a52')
      row = await oneRow(org, clazz, sha12('a52'), 0)
      console.log(row ? JSON.stringify(row) : 'NOT FOUND')

      {
        titre('collection auteurs z')
        const [rows, lpkv] = await getColl(org, clazz, 'auteurs', 'z', true, 0, false)
        rows.forEach(r => console.log(JSON.stringify(r)))
        console.log(JSON.stringify(lpkv))
      }
    }

    return 'OK'
  } catch (e) {
    console.log(e)
    return 'KO'
  }
}

setTimeout(async () => {
  const res = await main3()
  console.log(res)
}, 10)
