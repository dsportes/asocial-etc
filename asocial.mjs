/* Test d'accès au serveur par une session avec un login correct
par une application node.js standard, sans passer par un browser.
- pour l'appel POST : il faut positionner le header 'origin' à l'une des 
origines acceptées par la serveur. C'est donc libre et l'origine peut être fausse.
- pour WSS : 'le header origin n'est pas transmis. Dans le serveur 
on récupère le 'host' (c'est à dire l'adresse du serveur) dont on check l'origine. 
Or celle-ci est mise dans la liste des origines acceptées: 
  - en fait ce n'est pas obligatoire puisque un browser va passer par une 'origin'
  et non par le host.
Bloquer les "applis" pourrait se faire en bloquant ainsi le WSS (du moins quand il y en a un)
mais c'est à supposer qu'il n'existe pas d'API permettant de forcer une origine.
- Remarque: un browser ajoute un header 'origin' (en plus du 'host' qui est le serveur)
dans la request HTTP associée à un WebSocket. 

En conséquence la sécurité bloquant une application "pirate" utilisant l'API du serveur
SANS passer par un browser, tient seulement à la disponibilité
de la clé APITK : celle-ci est supposée n'être donnée qu'au déploiement.
Depuis une application "officièle" récupérer cette clé en debug du browser
ne semble pas simple. 
*/
import axios from 'axios'
import { encode, decode } from '@msgpack/msgpack'
import { randomBytes, pbkdf2Sync } from 'crypto'
import { sha256 as jssha256 } from 'js-sha256'
import { toByteArray, fromByteArray } from './base64.mjs'

import { openWS, closeWS } from './ws.mjs'

const decoder = new TextDecoder('utf-8')

const SALTS = new Array(256)

{
  const s = new Uint8Array([5, 255, 10, 250, 15, 245, 20, 240, 25, 235, 30, 230, 35, 225, 40, 220])
  SALTS[0] = s
  for (let i = 1; i < 256; i++) {
    const x = new Uint8Array(16)
    for (let j = 0; j < 16; j++) x[j] = (s[j] + i) % 256
    SALTS[i] = x
  }
}

const urlserveur = 'https://test.sportes.fr:8443'
export const urlwss = 'wss://test.sportes.fr:8443'
const origin = 'localhost:8343'
// const origin = 'test.sportes.fr:8343'
const APITK = 'VldNo2aLLvXRm0Q'
const headers = { 
  'x-api-version': '1',
  'origin': origin
}

export const PINGTO = 60 // en secondes. valeur élevée en test
export const E_BRK = 1000 // Interruption volontaire de l'opération
export const E_WS = 2000 // Toutes erreurs de réseau
export const E_DB = 3000 // Toutes erreurs d'accès à la base locale
export const E_BRO = 4000 // Erreur inattendue trappée sur le browser
export const F_BRO = 5000 // Erreur fonctionnelle trappée sur le browser
export const A_BRO = 6000 // Situation inattendue : assertion trappée par le browser
export const E_SRV = 7000 // Erreur inattendue trappée sur le serveur
export const F_SRV = 8000 // Erreur fonctionnelle trappée sur le serveur
export const A_SRV = 9000 // Situation inattendue : assertion trappée sur le serveur

export class AppExc {
  constructor (majeur, mineur, args, stack) {
    this.name = 'AppExc'
    this.code = majeur + (mineur || 0)
    if (args) { this.args = args; this.message = JSON.stringify(args) }
    else { this.args = []; this.message = '???'}
    if (stack) this.stack = stack
  }

  get majeur () { return Math.floor(this.code / 1000) }

  toString () {
    return JSON.stringify(this)
  }
}

/*
Envoi une requête POST :
- op : opération émettrice. Requise si interruptible, sinon facultative
- fonction : classe de l'opération invoquée
- args : objet avec les arguments qui seront transmis dans le body de la requête. Encodé par avro ou JSONStringify
Retour :
- OK : l'objet retourné par la fonction demandée - HTTP 400 : le résultat est un AppExc
Exception : un AppExc avec les propriétés code, message, stack
*/
async function post (op, fonction, args) {
  let buf
  try {
  const data = new Uint8Array(encode([args, APITK]))
    const u = urlserveur + '/op/' + fonction
    const par = { 
      method: 'post', 
      url: u, 
      data: data, 
      headers: headers, 
      responseType: 'arraybuffer'
    }
    const r = await axios(par)
    buf = r.data
  } catch (e) {
    procEx(e, op)
  }
  // les status HTTP non 2xx sont tombés en exception
  try {
    return decode(buf)
  } catch (e) { // Résultat mal formé
    throw new AppExc(E_BRO, 2, [op ? op.nom : '', e.message])
  }
}

export function isAppExc (e) {
  return e && (typeof e === 'object') && (e.name === 'AppExc')
}

function procEx (e, op) {
  // Exceptions jetées par le this.BRK au-dessus)
  if (isAppExc(e) && e.majeur * 1000 === E_BRK) throw e
  if (axios.isCancel(e)) throw new AppExc(E_BRK)

  const status = (e.response && e.response.status) || 0
  if (status >= 400 && status <= 403) {
    /*
    400 : F_SRV fonctionnelles
    401 : A_SRV assertions
    402 : E_SRV exception inattendue trappée dans le traitement
    403 : E_SRV exception inattendue NON trappée dans le traitement
    */
    let ex
    try {
      const x = JSON.parse(decoder.decode(e.response.data))
      ex = new AppExc(Math.floor(x.code / 1000) * 1000, x.code % 1000, x.args, x.stack)
    } catch (e2) {
      throw new AppExc(E_BRO, 1, [op ? op.nom : '', e2.message])
    }
    throw ex
  } else { 
    // inattendue, pas mise en forme (500 et autres)
    const code = !status ? 100 : (status >= 500 && status <= 599 ? 101 : 0)
    throw new AppExc(E_SRV, code, [status, e.message])
  }
}


/* crypto minimal *****************************************************/
function rnd6 () {
  const u8 = randomBytes(6)
  let r = u8[0]
  for (let i = 5; i > 0; i--) r += u8[i] * (p2[i - 1] + 1)
  return r
}

function u8ToB64 (u8, url) {
  const s = fromByteArray(u8)
  return !url ? s : s.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function b64ToU8 (s) {
  const diff = s.length % 4
  let x = s
  if (diff) {
    const pad = '===='.substring(0, 4 - diff)
    x = s + pad
  }
  return toByteArray(x.replace(/-/g, '+').replace(/_/g, '/'))
}

const p2 = [255, (256 ** 2) - 1, (256 ** 3) - 1, (256 ** 4) - 1, (256 ** 5) - 1, (256 ** 6) - 1, (256 ** 7) - 1]
function intToU8 (n) {
  if (n < 0) n = -n
  let l = 8
  for (let i = 6; i >= 0; i--, l--) if (n > p2[i]) break
  const u8 = new Uint8Array(l)
  for (let i = 0; i < 8; i++) {
    u8[i] = n % 256
    n = Math.floor(n / 256)
  }
  return u8
}

function intToB64 (n) {
  return u8ToB64(intToU8(n), true)
}

/* retourne un safe integer (53 bits) hash:
- d'un string
- d'un u8
*/
export function hash (arg) {
  const t = typeof arg
  const bin = t !== 'string'
  /* https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
    Many of the answers here are the same String.hashCode hash function taken 
    from Java. It dates back to 1981 from Gosling Emacs, 
    is extremely weak, and makes zero sense performance-wise in
    modern JavaScript. 
    In fact, implementations could be significantly faster by using ES6 Math.imul,
    but no one took notice. 
    We can do much better than this, at essentially identical performance.
    Here's one I did—cyrb53, a simple but high quality 53-bit hash. 
    It's quite fast, provides very good* hash distribution,
    and because it outputs 53 bits, has significantly lower collision rates
    compared to any 32-bit hash.
    Also, you can ignore SA's CC license as it's public domain on my GitHub.
  */
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0, ch; i < arg.length; i++) {
    ch = bin ? arg[i] : arg.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function sha256 (buffer) {
  // return ab2b(await window.crypto.subtle.digest('SHA-256', buffer))
  return new Uint8Array(jssha256.arrayBuffer(buffer))
}

function pbkfd (secret) {
  return pbkdf2Sync(secret, SALTS[0], 5000, 32, 'sha256')
}

/******************************************************
 * classe Phrase
******************************************************/
const encoder = new TextEncoder()
export class Phrase {
  static idxch = [0, 1, 2, 3, 4, 5 ,6, 7, 8, 9, 10, 11, 12, 14, 16, 17, 21, 24, 27]

  async init (texte, org) {
    const o1 = org || ''
    const i = o1.lastIndexOf('@')
    const o2 = i === -1 ? o1 : o1.substring(0, i)
    this.org = org
    const x = o2.padEnd(12, '$')
    this.phrase = texte
    const u8 = encoder.encode(x + texte)
    const deb = new Uint8Array(Phrase.idxch.length)
    for (let i = 0; i < Phrase.idxch.length; i++) deb[i] = u8[Phrase.idxch[i]]
    this.pcb = await pbkfd(u8)
    this.pcbh = hash(this.pcb)
    this.hps1 = hash(deb)
    return this
  }

  get shax () { return sha256(this.pcb) }

  get shax64 () { return u8ToB64(this.shax) }

  get shay () { return sha256(this.shax) } 

  // par compatibilité avec le code écrit avant fusion phrases
  get phch () { return this.hps1 } 
  get clex () { return this.pcb }

}

/* Session *****************************************************/
export class Session {

  constructor (phrase) {
    this.sessionId = intToB64(rnd6())
    if (phrase) {
      this.phrase = phrase
      // this.lsk = '$asocial$-' + phrase.hps1
    }
    const token = {
      sessionId: this.sessionId,
      shax: phrase ? phrase.shax : null,
      hps1: phrase ? phrase.hps1 : null
    }
    const x = new Uint8Array(encode(token))
    this.authToken = u8ToB64(new Uint8Array(x), true)
    // this.nombase = this.lsk ? localStorage.getItem(this.lsk) : ''
    // this.dateJourConnx = AMJ.amjUtc()
    this.status = 1
    Session.session = this
  }

  onrow (row) {
    console.log('Row reçu: ' + row._nom)
  }
}

const phraseSecrete = 'dodododododododododododo'
const org = 'coltes'

async function ouvrirSession () {
  try {
    const phrase = await new Phrase().init(phraseSecrete, org)
    const session = new Session(phrase)
    await openWS()
    const args = { token: session.authToken }
    // Connexion : récupération de rowCompta rowAvatar rowTribu fscredentials
    const ret = await post(this, 'ConnexionCompte', args)
    console.log('OKKKKKKKKKKKKKKKK ' + ret.dh)
  } catch (ex) {
    console.log(ex.toString())
  }
  closeWS()
}

ouvrirSession()

