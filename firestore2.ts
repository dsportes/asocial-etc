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

/* TODO
- gérer FTP.
- gérer la class LOCK et presetLock.
*/

import { env } from 'process'
import { FieldPath, DocumentReference, Firestore, Query, QuerySnapshot, 
  Timestamp, Transaction, WhereFilterOp, OrderByDirection } from '@google-cloud/firestore'
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
  row?: row | rowQ
}

class Operation {
  transaction: Transaction | null
  updates: update[]

  constructor (tr?: Transaction) {
    this.transaction = tr || null
    this.updates = []
  }

  setUpd (type: updType, dr: DocumentReference, row: row | rowQ ) {
    this.updates.push({type, dr, row})
  }

  setDel (dr: DocumentReference ) {
    this.updates.push({type: updType.DELETE, dr})
  }

  async commit () {
    for (const u of this.updates) {
      switch (u.type) {
        case updType.CREATE : {
          if (this.transaction) this.transaction.create(u.dr, u.row); else if (u.row) await u.dr.create(u.row)
          break
        }
        case updType.UPDATE : { 
          if (this.transaction) this.transaction.update(u.dr, {...u.row}); else await u.dr.update({...u.row})
          break
        }
        case updType.SET : { 
          if (this.transaction) this.transaction.set(u.dr, u.row); else if (u.row) await u.dr.set(u.row)
          break
        }
        case updType.DELETE : { 
          if (this.transaction) this.transaction.delete(u.dr); else await u.dr.delete()
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

type rowQ = {
  pk?: string,
  ttl?: Timestamp, // DB seulement - TTL pour purge automatique par la DB
  v: number,
  col: string
}

type row = {
  pk: string, // primary key (hash)
  v: number, // version: time de la dernière opération de création / maj / suppression
  maxLife?: number, // time de fin de vie programmée par l'application (précision en minutes)
  ttl?: Timestamp, // DB seulement - TTL pour purge automatique par la DB
  deleted?: boolean, // APP seulement - document supprimé
  data: string,
  [index: string]:any
}

/* Transforme un row DB en row APP
- calcul du TTL éventuel
- supprime deleted
- convertit maxLife en minutes
Retourne le row : v maxLife? ttl?
*/
function rowToDB (row: row) : row {
  if (!row.deleted && !row.maxLife) return row
  if (row.deleted){
    if (row.maxLife) delete row.maxLife
    delete row.deleted
    row.ttl = new Timestamp(Math.floor(row.v / 1000) + zombiLapse, 0)
    return row
  }
  if (!row.maxLife) return row
  if (row.maxLife > time) {
    row.ttl = new Timestamp(Math.floor(row.maxLife / 1000) + zombiLapse, 0)
    delete row.maxLife
    return row
  }
  row.maxLife = Math.floor(row.maxLife / 1440000) // en minutes (integer 32)
  return row
}

/* Transforme un row DB en row APP
- calcul de deleted 
- convertit maxLife en ms
Retourne le row (v, maxLife?, deleted?): si date de purge (ttl) dépassée retourne null
*/
function rowToAPP (row: row) : row | null{
  if (row.maxLife) row.maxLife = row.maxLife * 1440000
  if (!row.ttl) return row
  if (row.ttl.seconds * 1000 < time) return null
  if (!row.maxLife) { row.deleted = true; return row }
  if (row.maxLife < time) { delete row.maxLife; row.deleted = true }
  return row
}

function docRef (org: string, clazz: string, pk: string) {
  return fs.doc((org ? 'Org/'+ org + '/' : '') + clazz + '/' + pk)
}

function docRefQ (org: string, clazz: string, colName: string, pk: string, col: string) {
  return fs.doc('Org/'+ org + '/' + clazz + '@' + colName + '/' + pk + '@' + col)
}

function colRef (org: string, clazz: string) {
  return fs.collection((org ? 'Org/'+ org + '/' : '') + clazz)
}

function colRefQ (org: string, clazz: string, colName: string) {
  return fs.collection('Org/'+ org + '/' + clazz + '@' + colName)
}

type expList = {
  rows: row[],
  eox: boolean, // true si l'export est terminé (plus de documents à exporter)
  lastMark: string // dernière pk exportée
}

/* Exportation des rows n'ayant pas dépassé leur TTL
mark: dont les pk sont > pk
limit: nombre max de rows lus
Retourne:
  rows : la liste des rows
  eox: true si le nombre de rows exportés n'a pas atteint la limite
  lastMark: dernière pk lue
ATTENTION !!! mark ne doit pas être '' (mettre '0' pour commencer)
*/
async function exportRows (org: string, clazz: string, mark: string, limit: number) : Promise<expList> {
  let n = 0
  let lastMark = ''
  const rows: row[] = []
  const cr = colRef(org, clazz)
  const fp = FieldPath.documentId()
  const q: Query = cr.where(fp, '>', mark).orderBy(fp).limit(limit)
  const qs: QuerySnapshot = await q.get()
  if (!qs.empty) for (let doc of qs.docs) {
    n++
    lastMark = doc.id
    const row = rowToAPP(doc.data() as row)
    if (row) rows.push(row)
  }
  return { rows, eox: n < limit, lastMark} 
}

/* Purge limit documents - Retourne true si la limite n'a pas été atteinte (fini)
*/
async function purgeRows (org: string, clazz: string, limit: number) : Promise<boolean> {
  let n = 0
  const cr = colRef(org, clazz)
  const fp = FieldPath.documentId()
  const q: Query = cr.limit(limit)
  const qs: QuerySnapshot = await q.get()
  const eop = qs.docs.length < limit
  if (!qs.empty) for (let doc of qs.docs)
    await doc.ref.delete()
  return eop
}

async function importRows (org: string, clazz: string, rows: row[]) {
  for(const row of rows) {
    const r = rowToDB(row)
    const dr = docRef(org, clazz, r.pk)
    await dr.create(r)
  }
}

type expListQ = {
  rows: rowQ[],
  eox: boolean, // true si l'export est terminé (plus de documents à exporter)
  lastMark: string // dernière pk exportée
}

/* Exportation des rows n'ayant pas dépassé leur TTL
mark: dont les id sont > mark
limit: nombre max de rows lus
Retourne:
  rows : la liste des rows
  eox: true si le nombre de rows exportés n'a pas atteint la limite
  mark: dernière pk@col lue
*/
async function exportRowsQ (org: string, clazz: string, colName: string, mark: string, limit: number) 
  : Promise<expListQ> {
  let n = 0
  let lastMark = ''
  const rows: rowQ[] = []
  const cq = colRefQ(org, clazz, colName)
  const fp = FieldPath.documentId()
  const q: Query = cq.where(fp, '>', mark).orderBy(fp).limit(limit)

  const qs: QuerySnapshot = await q.get()
  if (!qs.empty) for (let doc of qs.docs) {
    n++
    lastMark = doc.id
    const ttl = doc.get('ttl') as Timestamp
    if (ttl.seconds * 1000 > time) {
      const v = doc.get('v')
      const col = doc.get('col')
      const pk = doc.id.substring(0, doc.id.indexOf('@'))
      rows.push({pk, col, v})
    }
  }
  return { rows, eox: n < limit, lastMark} 
}

/* Purge limit documents - Retourne true si la limite n'a pas été atteinte (fini)
*/
async function purgeRowsQ (org: string, clazz: string, colName: string, limit: number) : Promise<boolean> {
  let n = 0
  const cq = colRefQ(org, clazz, colName)
  const fp = FieldPath.documentId()
  const q: Query = cq.limit(limit)
  const qs: QuerySnapshot = await q.get()
  const eop = qs.docs.length < limit
  if (!qs.empty) for (let doc of qs.docs)
    await doc.ref.delete()
  return eop
}

async function importRowsQ (org: string, clazz: string, colName: string, rows: rowQ[]) {
  for(const row of rows) {
    const dr = docRefQ(org, clazz, colName, row.pk || '', row.col)
    const r : rowQ = { 
      col: row.col, 
      v: row.v,
      ttl:  new Timestamp(Math.floor(row.v / 1000) + zombiLapse, 0)
    }
    await dr.create(r)
  }
}

/* Import (insert / create) un row:
- clazz: classe du document - 'Article'
- org: code l'organisation - 'demo'
- row: row
*/
async function writeRow (ut: updType, org: string, clazz: string, row: row) {
  op.setUpd(ut, docRef(org, clazz, row.pk), rowToDB(row))
}

async function deleteDoc (org: string, clazz: string, pk: string) {
  op.setDel(docRef(org, clazz, pk))
}

/* Inscrit le rowQ déclarant que le document clazz/pk ne fait plus
partie de la collection clazz/col à partir de v.
- clazz: classe du document - 'Article'
- org: code l'organisation - 'demo'
- colName: nom de la propriété de sous-collection 
- row APP: { v, col, pk }
Path: Org/demo/Article@auteurs/a5@Hugo
row DB: { v, col, ttl }
*/
async function writeRowQ (org: string, clazz: string, colName: string, row: rowQ) {
  const r : rowQ = { 
    col: row.col, 
    v: row.v,
    ttl:  new Timestamp(Math.floor(row.v / 1000) + zombiLapse, 0)
  }
  op.setUpd(updType.SET, docRefQ(org, clazz, colName, row.pk || '', row.col), r)
}

/* Retourne tous les rows de la classe indiquée:
- si v = 0: tous ceux existant réellement à l'instant t.
- sinon: ceux mis à jour ou supprimés postérieueremt à v.
*/
async function allRows (org: string, clazz: string, v: number) : Promise<Object[]>{
  
  const rows: row[] = []
  const cr = colRef(org, clazz)
  const q: Query = !v ? cr : cr.where('v', '>', v)
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (!qs.empty) for (let doc of qs.docs) {
    const row = rowToAPP(doc.data() as row)
    if (row && (v || !row.deleted)) rows.push(row)
  }
  return rows
}

/* Retourne le row de classe fixée ayant la pk fixée:
- si v absent: ne retourne pas le row s'il est supprimé
- si v présent ne retourne le row QUE s'il a été mis à jour ou supprimé après v.
  si supprimé , le data l'indique.
*/
async function oneRow (org: string, clazz: string, pk: string, v: number) : Promise<row | null> {
  const cr = colRef(org, clazz)
  const q: Query = !v ? cr.where('pk', '==', pk) : cr.where('pk', '==', pk).where('v', '>', v)
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (qs.empty) return null
  const row = rowToAPP(qs.docs[0].data() as row)
  return !row || (!v && row.deleted) ? null : row
}

type pkv = [ pk: string, v: number ]

/* Retourne la sous-collection 'clazz/colName/col' (par exemple: Article/auteurs/Zola)
sous la forme de deux listes:
- une liste D des documents de la classe clazz,
- une liste Q des couples (pk, v) des documents ayant quitté la sous-collection.

Si v est absent:
- D: liste INTEGRALE des documents de la sous-collection à l'instant t.
- Q est vide.

Si v est présent:
- D: liste des documents ayant 'Zola' dans sa liste d'auteurs,
  - créés après v.
  - modifiés après v.
  - zombifiés après v.
- Q: liste des couples (pk, v) des documents de clé pk,
  - ayant quitté la sous-collection postérieurement à v (possiblement par zombification).
Il se peut que dans Q soient cités des documents ayant quitté la collection
à t2 alors qu'ils inscrits comme présents à t3 dans D. Ils sont à ignorer (D l'emporte sur Q)

isList: true si la propriété 'auteurs' est une liste.
*/
async function getColl(org: string, clazz: string, 
  colName: string, col: string, isList: boolean, v: number) : Promise<[row[], pkv[]]> {
  
  const rows: row[] = []
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
    const row = rowToAPP(doc.data() as row)
    if (row && (v || !row.deleted)) rows.push(row)
  }

  if (v) {
    q = crq.where('col', '==', col).where('v', '>', v)
    const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
    if (!qs.empty) for (let doc of qs.docs) {
      const ttl = doc.get('ttl') as Timestamp
      if (ttl.seconds * 1000 > time) {
        const v = doc.get('v')
        const pk = doc.id.substring(0, doc.id.indexOf('@'))
        lpkv.push([pk, v])
      }
    }
  }

  return [rows, lpkv]
}

enum filter { LT, LE, EQ, NE, GE, GT, CONTAINS, CONTAINSANY }
const opFilter = [ '<', '<=', '==', '!=', '>=', '>', 'array-contains', 'array-contains-any']

async function selectDocs(org: string, clazz: string, colName: string, filter: filter, col: any, 
  order: string, limit: number, fn: Function) {
  
  let q: Query = colRef(org, clazz).where(colName, opFilter[filter] as WhereFilterOp, col)
  if (order) q = q.orderBy(order)
  if (limit) q = q.limit(limit)
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (!qs.empty) for (let doc of qs.docs) {
    const row = rowToAPP(doc.data() as row)
    fn(row)
  }
}

async function selectDocsGlobal(clazz: string, colName: string, filter: filter, col: any, 
  order: string, limit: number, fn: Function) {

  let q: Query = fs.collectionGroup(clazz).where(colName, opFilter[filter] as WhereFilterOp, col)
  if (order) {
    let dir = 'asc'
    if (order.startsWith('-')) {
      order = order.substring(1)
      dir = 'desc'
    }
    q = q.orderBy(order, dir as OrderByDirection)
  }
  if (limit) q = q.limit(limit)
  const qs: QuerySnapshot = op.transaction ? await op.transaction.get(q) : await q.get()
  if (!qs.empty) for (let doc of qs.docs) {
    const row = rowToAPP(doc.data() as row)
    const p = doc.ref.path
    const i = p.indexOf('/', 5)
    const org = p.substring(4, i)
    fn(org, row)
  }
}

// Simulation de la couche au-dessus
function getPk (data: any, props: string[]) {
  if (props.length === 1) return sha12(data[props[0]])
  const t : string[] = []
  props.forEach(p => { t.push(data[p])})
  return sha12(t.join('/')) 
}

class Rb {
  row: row
  data: {[index: string]:any}
  constructor (data: any, props: string[]) {
    this.data = data
    this.row = { 
      pk: getPk(data, props), 
      v: data['v'],
      data: JSON.stringify(data)
    }
    if (data['deleted']) this.row.deleted = true
    const ml = data['maxLife'] // epoch de FIN DE VIE applicative
    if (ml) this.row.maxLife = ml
  }
  addIdx (name: string) {
    this.row[name] = this.data[name]
    return this
  }
}

async function importArt (data: Object) {
  await writeRow (updType.CREATE, org, clazz, new Rb(data, ['id']).addIdx('auteurs').addIdx('sujet').addIdx('volume').row)
}

async function updateArt (data: Object) {
  await writeRow (updType.UPDATE, org, clazz, new Rb(data, ['id']).addIdx('auteurs').addIdx('sujet').addIdx('volume').row)
}

async function zombiArt (data: Object) {
  await writeRow (updType.UPDATE, org, clazz, new Rb(data, ['id']).row)
}

async function importHdr (v: number, label: string, status: number) {
  await writeRow (updType.CREATE, '', 'ROOT', { pk: 'hdr', v: v, data: JSON.stringify({ v, label, status})})
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

async function main4 () : Promise<string> {
  try {
    for(let i = 0; i < 4; i++)
      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        await importArt({ id: 'a5' + i, auteurs: ['h', 'v'], sujet: 'S1', volume: 50, v: time + 100 + i, texte: 'blabla' })
        await importArt({ id: 'a6' + i, auteurs: ['h', 'q', 'z'], volume: 60, sujet: 'S1', v: time + 100 + i, texte: 'blublu' })
        await importArt({ id: 'a7' + i, auteurs: ['z'], sujet: 'S1', volume: 70, v: time + 100 + i, texte: 'blublu' })
        await op.commit()
      })

    op = new Operation()

    await selectDocs(org, clazz, 'auteurs', filter.CONTAINSANY, ['q', 'z'], '', 0, (row: row) => {
      const data = JSON.parse(row.data)
      console.log('selected ', row.pk, data.id, data.auteurs)
    })

    await selectDocsGlobal(clazz, 'volume', filter.GT, 50, '-volume', 5, (org: row, row: row) => {
      const data = JSON.parse(row.data)
      console.log('selectedG ', row.pk, data.id, org, data.volume)
    })

    titre('Article a52')
    let row = await oneRow(org, clazz, sha12('a52'), 0)
    console.log(row ? JSON.stringify(row) : 'NOT FOUND')
    let a52 = row

    clockPlus(1000)
    if (a52) {
      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        if (a52) await deleteDoc(org, clazz, a52.pk)
        op.commit()
      })
    }

    op = new Operation()
    titre('Article a52')
    row = await oneRow(org, clazz, sha12('a52'), 0)
    console.log(row ? JSON.stringify(row) : 'NOT FOUND')
    a52 = row

    return 'OK'
  } catch (e) {
    console.log(e)
    return 'KO'
  }
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
        await importArt({ id: 'a6' + i, auteurs: ['h', 'q', 'z'], sujet: 'S1', v: time + 100 + i, texte: 'blublu' })
        await importArt({ id: 'a7' + i, auteurs: ['z'], sujet: 'S1', v: time + 100 + i, texte: 'blublu' })
        await op.commit()
      })

    op = new Operation()

    await selectDocs(org, clazz, 'auteurs', filter.CONTAINSANY, ['q', 'z'], '', 0, (row: row) => {
      const data = JSON.parse(row.data)
      console.log('selected ', row.pk, data.id, data.auteurs)
    })

    let rows: Object[]
    let row: row | null
    let a52: row | null
    let a62: row | null

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
    
    t = 0
    titre('Article a62')
    row = await oneRow(org, clazz, sha12('a62'), 0)
    console.log(row ? JSON.stringify(row) : 'NOT FOUND')
    a62 = row

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
      const [rows, lpkv] = await getColl(org, clazz, 'auteurs', 'h', true, 0)
      rows.forEach(r => console.log(JSON.stringify(r)))
      console.log(JSON.stringify(lpkv))
    }

    clockPlus(1000)
    if (a52 && a62) {
      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        const data = JSON.parse(a52.data)
        data['texte'] = 'blibli'
        data['v'] = time + 100
        data['auteurs'] = ['v', 'z']
        await updateArt(data)
        const rowQ : rowQ = { pk: a52.pk, col: 'h', v: time }
        await writeRowQ (org, clazz, 'auteurs', rowQ)
        op.commit()
      })

      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        const data = JSON.parse(a62.data)
        data['texte'] = 'blxblx'
        data['v'] = time + 100
        data['auteurs'] = ['q', 'z']
        await updateArt(data)
        const rowQ : rowQ = { pk: a62.pk, col: 'h', v: time }
        await writeRowQ (org, clazz, 'auteurs', rowQ)
        op.commit()
      })

      op = new Operation()

      { // Inspection des rowQ
        const cq = colRefQ(org, clazz, 'auteurs')
        // 'RPHVLc4-bjzVMLCW@a'
        // D'après la doc le orderBy est appliqué par défaut
        const fp = FieldPath.documentId()
        const q = cq.where(fp, '>', '0').orderBy(fp)
        const qs: QuerySnapshot = /* op.transaction ? await op.transaction.get(q) : */ await q.get()
        if (!qs.empty) for (let doc of qs.docs) {
          const v = doc.get('v')
          const col = doc.get('col')
          const pk = doc.id.substring(0, doc.id.indexOf('@'))
          console.log('pk col v: ', pk, col, v)
        }
      }

      titre('Article a52')
      row = await oneRow(org, clazz, sha12('a52'), 0)
      console.log(row ? JSON.stringify(row) : 'NOT FOUND')

      {
        titre('collection auteurs h')
        const [rows, lpkv] = await getColl(org, clazz, 'auteurs', 'h', true, time - 1)
        rows.forEach(r => console.log(JSON.stringify(r)))
        console.log(JSON.stringify(lpkv))
      }

      {
        titre('collection auteurs h')
        const [rows, lpkv] = await getColl(org, clazz, 'auteurs', 'h', true, 0)
        rows.forEach(r => console.log(JSON.stringify(r)))
        console.log(JSON.stringify(lpkv))
      }

      {
        titre('collection auteurs z')
        const [rows, lpkv] = await getColl(org, clazz, 'auteurs', 'z', true, 0)
        rows.forEach(r => console.log(JSON.stringify(r)))
        console.log(JSON.stringify(lpkv))
      }
    }

    clockPlus(1000)
    if (a52) {
      await fs.runTransaction(async (tr) => { 
        op = new Operation(tr)
        const data = { id: 'a52', v: time, deleted: true }
        await zombiArt(data)
        await writeRowQ (org, clazz, 'auteurs', { pk: a52.pk, col: 'v', v: time })
        await writeRowQ (org, clazz, 'auteurs', { pk: a52.pk, col: 'z', v: time })
        op.commit()
      })

      op = new Operation()
      titre('Article a52')
      row = await oneRow(org, clazz, sha12('a52'), 0)
      console.log(row ? JSON.stringify(row) : 'NOT FOUND')

      {
        titre('collection auteurs z')
        const [rows, lpkv] = await getColl(org, clazz, 'auteurs', 'z', true, 0)
        rows.forEach(r => console.log(JSON.stringify(r)))
        console.log(JSON.stringify(lpkv))
      }
    }

    const myRows : row[] = []
    let mark = '0' // ATTENTION!!! ne pas mettre ''
    let fin = false
    while (!fin) {
      const { rows, eox, lastMark } = await exportRows(org, clazz, mark, 3)
      rows.forEach(r => { myRows.push(r); console.log('export D: ', r.pk)})
      fin = eox
      mark = lastMark
    }

    const myRowsQ : rowQ[] = []
    mark = '0' // ATTENTION!!! ne pas mettre ''
    fin = false
    while (!fin) {
      const { rows, eox, lastMark } = await exportRowsQ(org, clazz, 'auteurs', mark, 3)
      rows.forEach(r => { myRowsQ.push(r); console.log('export Q: ', r.pk, r.col, r.v)})
      fin = eox
      mark = lastMark
    }

    fin = false
    while (!fin) {
      fin = await purgeRows(org, clazz, 5)
    }

    fin = false
    while (!fin) {
      fin = await purgeRowsQ(org, clazz, 'auteurs', 5)
    }

    await importRows(org, clazz, myRows)

    await importRowsQ(org, clazz, 'auteurs', myRowsQ)

    return 'OK'
  } catch (e) {
    console.log(e)
    return 'KO'
  }
}

setTimeout(async () => {
  const res = await main4()
  console.log(res)
}, 10)
