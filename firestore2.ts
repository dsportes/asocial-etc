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
import { Firestore } from '@google-cloud/firestore'
import crypto from 'crypto'

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

// eslint-disable-next-line no-unused-vars
async function main1 () {
  try {
    const fs = new Firestore()
    const dr = fs.doc('singletons/ping')
    await dr.set({ dh: new Date().toISOString() })
  } catch (e) {
    console.log(e)
  }
}

async function main2 () {
  try {
    const fs = new Firestore()
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

main2()
